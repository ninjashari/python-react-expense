"""One-time (re-runnable) copy of existing Postgres data into MongoDB.

Usage:
    python -m scripts.backfill_mongo [--since 2025-01-01T00:00:00]

Runs in dependency order: users -> accounts/categories/payees -> transactions
(resolving embedded snapshots) -> learning_* and reward_points_* tables.
Every write is an upsert keyed by the Postgres UUID (reused as the Mongo _id),
so re-running is safe - use --since to only pick up rows created/updated after
a given timestamp (e.g. right after dual-write went live, to catch anything
written before that point).

transaction_splits is intentionally not migrated: it has no SQLAlchemy model,
an empty upgrade(), and no source data - dead code excluded from this migration.
"""
import argparse
import asyncio
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import joinedload

from database import SessionLocal
from database_mongo import init_mongo
from models.users import User
from models.accounts import Account
from models.categories import Category
from models.payees import Payee
from models.transactions import Transaction
from models.learning import (
    UserTransactionPattern,
    UserSelectionHistory,
    UserCorrectionPattern,
    LearningStatistics,
)
from models.reward_points import RewardPointRedemption, RewardPointBonus

from models_mongo.users import UserDocument
from models_mongo.accounts import AccountDocument
from models_mongo.categories import CategoryDocument
from models_mongo.payees import PayeeDocument
from models_mongo.transactions import TransactionDocument, AccountRef, CategoryRef, PayeeRef
from models_mongo.learning import (
    UserTransactionPatternDocument,
    UserSelectionHistoryDocument,
    UserCorrectionPatternDocument,
    LearningStatisticsDocument,
)
from models_mongo.reward_points import RewardPointRedemptionDocument, RewardPointBonusDocument

BATCH_SIZE = 500


async def upsert_batch(docs):
    for doc in docs:
        existing = await type(doc).get(doc.id)
        if existing:
            await existing.set(doc.dict(exclude={"id"}))
        else:
            await doc.insert()


def _since_filter(query, model, since):
    if since is None:
        return query
    if hasattr(model, "updated_at"):
        return query.filter(model.updated_at >= since)
    if hasattr(model, "created_at"):
        return query.filter(model.created_at >= since)
    return query


async def backfill_users(db, since):
    query = _since_filter(db.query(User), User, since)
    count = 0
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([UserDocument(
            id=str(row.id), email=row.email, password_hash=row.password_hash,
            name=row.name, created_at=row.created_at, updated_at=row.updated_at,
        )])
        count += 1
    print(f"users: {count}")


async def backfill_accounts(db, since):
    query = _since_filter(db.query(Account), Account, since)
    count = 0
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([AccountDocument(
            id=str(row.id), user_id=str(row.user_id), name=row.name, type=row.type,
            balance=float(row.balance) if row.balance is not None else 0.0,
            opening_balance=float(row.opening_balance) if row.opening_balance is not None else 0.0,
            account_number=row.account_number, card_number=row.card_number,
            card_expiry_month=row.card_expiry_month, card_expiry_year=row.card_expiry_year,
            credit_limit=float(row.credit_limit) if row.credit_limit is not None else None,
            bill_generation_date=row.bill_generation_date, payment_due_date=row.payment_due_date,
            interest_rate=float(row.interest_rate) if row.interest_rate is not None else None,
            status=row.status, opening_date=row.opening_date, currency=row.currency,
            created_at=row.created_at, updated_at=row.updated_at,
        )])
        count += 1
    print(f"accounts: {count}")


async def backfill_categories(db, since):
    query = _since_filter(db.query(Category), Category, since)
    count = 0
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([CategoryDocument(
            id=str(row.id), user_id=str(row.user_id), name=row.name, slug=row.slug,
            color=row.color, is_investment=bool(row.is_investment),
            created_at=row.created_at, updated_at=row.updated_at,
        )])
        count += 1
    print(f"categories: {count}")


async def backfill_payees(db, since):
    query = _since_filter(db.query(Payee), Payee, since)
    count = 0
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([PayeeDocument(
            id=str(row.id), user_id=str(row.user_id), name=row.name, slug=row.slug,
            color=row.color, created_at=row.created_at, updated_at=row.updated_at,
        )])
        count += 1
    print(f"payees: {count}")


def _account_ref(account):
    if not account:
        return None
    return AccountRef(id=str(account.id), name=account.name, type=account.type)


def _category_ref(category):
    if not category:
        return None
    return CategoryRef(id=str(category.id), name=category.name, color=category.color)


def _payee_ref(payee):
    if not payee:
        return None
    return PayeeRef(id=str(payee.id), name=payee.name, color=payee.color)


async def backfill_transactions(db, since):
    query = db.query(Transaction).options(
        joinedload(Transaction.account),
        joinedload(Transaction.to_account),
        joinedload(Transaction.category),
        joinedload(Transaction.payee),
    )
    query = _since_filter(query, Transaction, since)

    count = 0
    batch = []
    for row in query.yield_per(BATCH_SIZE):
        batch.append(TransactionDocument(
            id=str(row.id), user_id=str(row.user_id), account_id=str(row.account_id),
            to_account_id=str(row.to_account_id) if row.to_account_id else None,
            category_id=str(row.category_id) if row.category_id else None,
            payee_id=str(row.payee_id) if row.payee_id else None,
            amount=float(row.amount), type=row.type, description=row.description,
            notes=row.notes, date=row.date,
            balance_after_transaction=float(row.balance_after_transaction) if row.balance_after_transaction is not None else None,
            to_account_balance_after=float(row.to_account_balance_after) if row.to_account_balance_after is not None else None,
            reward_points=float(row.reward_points) if row.reward_points is not None else None,
            account=_account_ref(row.account), to_account=_account_ref(row.to_account),
            category=_category_ref(row.category), payee=_payee_ref(row.payee),
            created_at=row.created_at, updated_at=row.updated_at,
        ))
        count += 1
        if len(batch) >= BATCH_SIZE:
            await upsert_batch(batch)
            batch = []
            print(f"transactions: {count}", end="\r")
    if batch:
        await upsert_batch(batch)
    print(f"transactions: {count}")


async def backfill_learning(db, since):
    count = 0
    query = _since_filter(db.query(UserTransactionPattern), UserTransactionPattern, since)
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([UserTransactionPatternDocument(
            id=str(row.id), user_id=str(row.user_id),
            description_keywords=list(row.description_keywords or []),
            payee_id=str(row.payee_id) if row.payee_id else None,
            category_id=str(row.category_id) if row.category_id else None,
            confidence_score=row.confidence_score, usage_frequency=row.usage_frequency,
            success_rate=row.success_rate, last_used=row.last_used, created_at=row.created_at,
            amount_min=row.amount_min, amount_max=row.amount_max,
            account_types=list(row.account_types) if row.account_types else None,
            transaction_type=row.transaction_type, context_data=row.context_data or {},
        )])
        count += 1
    print(f"user_transaction_patterns: {count}")

    count = 0
    query = _since_filter(db.query(UserSelectionHistory), UserSelectionHistory, since)
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([UserSelectionHistoryDocument(
            id=str(row.id), user_id=str(row.user_id),
            transaction_id=str(row.transaction_id) if row.transaction_id else None,
            field_type=row.field_type,
            selected_value_id=str(row.selected_value_id) if row.selected_value_id else None,
            selected_value_name=row.selected_value_name,
            transaction_description=row.transaction_description,
            transaction_amount=row.transaction_amount, account_type=row.account_type,
            was_suggested=bool(row.was_suggested), suggestion_confidence=row.suggestion_confidence,
            selection_method=row.selection_method, created_at=row.created_at,
        )])
        count += 1
    print(f"user_selection_history: {count}")

    count = 0
    query = _since_filter(db.query(UserCorrectionPattern), UserCorrectionPattern, since)
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([UserCorrectionPatternDocument(
            id=str(row.id), user_id=str(row.user_id),
            original_suggestion_type=row.original_suggestion_type,
            original_suggestion_id=str(row.original_suggestion_id) if row.original_suggestion_id else None,
            original_suggestion_name=row.original_suggestion_name,
            user_correction_id=str(row.user_correction_id) if row.user_correction_id else None,
            user_correction_name=row.user_correction_name,
            transaction_description=row.transaction_description,
            transaction_amount=row.transaction_amount, suggestion_confidence=row.suggestion_confidence,
            correction_frequency=row.correction_frequency, context_data=row.context_data or {},
            first_seen=row.first_seen, last_seen=row.last_seen,
        )])
        count += 1
    print(f"user_correction_patterns: {count}")

    count = 0
    query = _since_filter(db.query(LearningStatistics), LearningStatistics, since)
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([LearningStatisticsDocument(
            id=str(row.id), user_id=str(row.user_id),
            total_suggestions_made=row.total_suggestions_made,
            total_suggestions_accepted=row.total_suggestions_accepted,
            total_patterns_learned=row.total_patterns_learned,
            average_confidence=row.average_confidence, success_rate=row.success_rate,
            last_updated=row.last_updated,
        )])
        count += 1
    print(f"learning_statistics: {count}")


async def backfill_reward_points(db, since):
    count = 0
    query = _since_filter(db.query(RewardPointRedemption), RewardPointRedemption, since)
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([RewardPointRedemptionDocument(
            id=str(row.id), user_id=str(row.user_id), account_id=str(row.account_id),
            date=row.date, points_used=float(row.points_used), description=row.description,
            created_at=row.created_at, updated_at=row.updated_at,
        )])
        count += 1
    print(f"reward_point_redemptions: {count}")

    count = 0
    query = _since_filter(db.query(RewardPointBonus), RewardPointBonus, since)
    for row in query.yield_per(BATCH_SIZE):
        await upsert_batch([RewardPointBonusDocument(
            id=str(row.id), user_id=str(row.user_id), account_id=str(row.account_id),
            date=row.date, points=float(row.points), description=row.description,
            source_file=row.source_file, created_at=row.created_at, updated_at=row.updated_at,
        )])
        count += 1
    print(f"reward_point_bonuses: {count}")


async def main(since):
    await init_mongo()
    db = SessionLocal()
    try:
        # Dependency order: users -> accounts/categories/payees -> transactions -> learning/rewards
        await backfill_users(db, since)
        await backfill_accounts(db, since)
        await backfill_categories(db, since)
        await backfill_payees(db, since)
        await backfill_transactions(db, since)
        await backfill_learning(db, since)
        await backfill_reward_points(db, since)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill MongoDB from Postgres.")
    parser.add_argument("--since", type=str, default=None, help="ISO timestamp; only rows updated/created since then.")
    args = parser.parse_args()
    since_dt = datetime.fromisoformat(args.since) if args.since else None
    asyncio.run(main(since_dt))
