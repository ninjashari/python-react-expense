"""
Verification script: actually calls the real (now-fixed) recalculate_all_balances
function for every user in the DB, and compares each account's balance before vs
after. Reports any account whose balance changed (which would indicate the
opening_balance backfill did NOT make recalculation a no-op).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from decimal import Decimal
from database import SessionLocal
from models.accounts import Account
from models.users import User
from routers.accounts import recalculate_all_balances


def main():
    db = SessionLocal()
    try:
        # Snapshot all balances before
        before = {
            str(a.id): (a.name, a.balance)
            for a in db.query(Account).all()
        }

        users = db.query(User).all()
        print(f"Found {len(users)} users")

        for user in users:
            print(f"\nRecalculating for user {user.email} ({user.id})...")
            result = recalculate_all_balances(db=db, current_user=user)
            print(f"  {result['message']}")

        # Snapshot after
        db.expire_all()
        after = {
            str(a.id): (a.name, a.balance)
            for a in db.query(Account).all()
        }

        print("\n--- Comparison ---")
        changed = []
        for acc_id, (name, before_bal) in before.items():
            after_name, after_bal = after.get(acc_id, (None, None))
            if after_bal is None:
                print(f"MISSING after recalculation: {name} ({acc_id})")
                continue
            diff = (after_bal or Decimal('0')) - (before_bal or Decimal('0'))
            status = "OK" if abs(diff) < Decimal('0.01') else "CHANGED"
            if status == "CHANGED":
                changed.append((name, before_bal, after_bal, diff))
            print(f"{status:8s} {name[:40]:40s} before={before_bal:>15} after={after_bal:>15} diff={diff:>10}")

        print(f"\nTotal accounts: {len(before)}, changed: {len(changed)}")
        if changed:
            print("\nAccounts with balance changes:")
            for name, b, a, d in changed:
                print(f"  {name}: {b} -> {a} (diff {d})")

        # Ground truth spot checks
        for name, expected in [
            ("ICICI Bank Demat Linked", Decimal('1944.36')),
        ]:
            for acc_id, (n, bal) in after.items():
                if n == name:
                    print(f"\nGround truth: {name} final balance = {bal} (expected {expected}) "
                          f"match={abs(bal - expected) < Decimal('0.01')}")

    finally:
        db.close()


if __name__ == '__main__':
    main()
