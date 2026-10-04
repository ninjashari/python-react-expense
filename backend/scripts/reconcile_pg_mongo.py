"""Per-user, per-collection reconciliation between Postgres and MongoDB.

Compares row counts for every mirrored table/collection, plus a checksum over
transactions (hash of sorted (id, amount, type, date, balance_after_transaction))
to catch silent mirror drift that a count match alone would miss.

Usage:
    python -m scripts.reconcile_pg_mongo [--user-id <uuid>]

Exit code is 0 if everything matches, 1 if any mismatch was found - suitable
for a scheduled job during the dual-write transition window.
"""
import argparse
import asyncio
import hashlib
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database import SessionLocal
from database_mongo import init_mongo
from models.users import User
from models.accounts import Account
from models.categories import Category
from models.payees import Payee
from models.transactions import Transaction

from models_mongo.accounts import AccountDocument
from models_mongo.categories import CategoryDocument
from models_mongo.payees import PayeeDocument
from models_mongo.transactions import TransactionDocument


def _transaction_checksum(rows):
    """Hash of sorted (id, amount, type, date, balance_after_transaction) tuples."""
    parts = sorted(
        f"{r[0]}|{r[1]}|{r[2]}|{r[3]}|{r[4]}"
        for r in rows
    )
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()


async def reconcile_user(db, user_id) -> bool:
    ok = True
    user_id_str = str(user_id)

    checks = [
        ("accounts", db.query(Account).filter(Account.user_id == user_id).count(),
         await AccountDocument.find(AccountDocument.user_id == user_id_str).count()),
        ("categories", db.query(Category).filter(Category.user_id == user_id).count(),
         await CategoryDocument.find(CategoryDocument.user_id == user_id_str).count()),
        ("payees", db.query(Payee).filter(Payee.user_id == user_id).count(),
         await PayeeDocument.find(PayeeDocument.user_id == user_id_str).count()),
        ("transactions", db.query(Transaction).filter(Transaction.user_id == user_id).count(),
         await TransactionDocument.find(TransactionDocument.user_id == user_id_str).count()),
    ]
    for name, pg_count, mongo_count in checks:
        if pg_count != mongo_count:
            print(f"  MISMATCH {name}: postgres={pg_count} mongo={mongo_count}")
            ok = False

    def _num(v):
        # Postgres Decimal and Mongo float stringify differently for the same
        # value (Decimal('200.00') vs 200.0) - normalize to a fixed-precision
        # float string so equal values checksum equal regardless of source type.
        return "" if v is None else f"{float(v):.2f}"

    def _date_str(d):
        # Postgres Transaction.date is a datetime, Mongo TransactionDocument.date is a plain
        # date - str() of a datetime includes "00:00:00" that str() of a date doesn't, so
        # normalize both to a date-only string before comparing.
        return (d.date() if isinstance(d, datetime) else d).isoformat()

    pg_rows = [
        (str(t.id), _num(t.amount), t.type, _date_str(t.date), _num(t.balance_after_transaction))
        for t in db.query(Transaction).filter(Transaction.user_id == user_id).all()
    ]
    mongo_txns = await TransactionDocument.find(TransactionDocument.user_id == user_id_str).to_list()
    mongo_rows = [
        (t.id, _num(t.amount), t.type, _date_str(t.date), _num(t.balance_after_transaction))
        for t in mongo_txns
    ]
    pg_checksum = _transaction_checksum(pg_rows)
    mongo_checksum = _transaction_checksum(mongo_rows)
    if pg_checksum != mongo_checksum:
        print(f"  MISMATCH transactions checksum: postgres={pg_checksum} mongo={mongo_checksum}")
        ok = False

    return ok


async def main(user_id_filter):
    await init_mongo()
    db = SessionLocal()
    try:
        if user_id_filter:
            users = db.query(User).filter(User.id == user_id_filter).all()
        else:
            users = db.query(User).all()

        all_ok = True
        for user in users:
            print(f"user {user.id} ({user.email}):")
            ok = await reconcile_user(db, user.id)
            all_ok = all_ok and ok
            if ok:
                print("  OK")
        return all_ok
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reconcile Postgres and MongoDB.")
    parser.add_argument("--user-id", type=str, default=None)
    args = parser.parse_args()
    result = asyncio.run(main(args.user_id))
    sys.exit(0 if result else 1)
