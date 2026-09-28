"""Dual-write mirror: after a Postgres commit, best-effort copy the same row into
MongoDB via Beanie. Postgres is the durability boundary during the transition -
every function here swallows and logs its own failures rather than raising, so a
Mongo outage can never break the Postgres-backed request that triggered it.

Callers hand these functions to BackgroundTasks.add_task(...) right after the
Postgres db.commit() for a mutation, e.g.:

    background_tasks.add_task(mongo_sync.mirror_transaction_upsert, db, db_transaction.id)

Each function re-reads the row it needs from `db` (the same request-scoped
SQLAlchemy session) rather than trusting objects passed in by the caller, since
FastAPI runs background tasks before closing yield-based dependencies but the
caller's in-memory objects may be stale (e.g. after other fields changed).
"""
import logging
from typing import Optional

from sqlalchemy.orm import Session, joinedload

from database_mongo import ensure_mongo_ready
from models.accounts import Account
from models.categories import Category
from models.payees import Payee
from models.transactions import Transaction
from models.users import User
from models.learning import (
    UserTransactionPattern,
    UserSelectionHistory,
    UserCorrectionPattern,
    LearningStatistics,
)
from models.reward_points import RewardPointRedemption, RewardPointBonus
from models_mongo.accounts import AccountDocument
from models_mongo.categories import CategoryDocument
from models_mongo.payees import PayeeDocument
from models_mongo.users import UserDocument
from models_mongo.transactions import TransactionDocument, AccountRef, CategoryRef, PayeeRef
from models_mongo.learning import (
    UserTransactionPatternDocument,
    UserSelectionHistoryDocument,
    UserCorrectionPatternDocument,
    LearningStatisticsDocument,
)
from models_mongo.reward_points import RewardPointRedemptionDocument, RewardPointBonusDocument

logger = logging.getLogger("mongo_sync")


def _account_ref(account: Optional[Account]) -> Optional[AccountRef]:
    if not account:
        return None
    return AccountRef(id=str(account.id), name=account.name, type=account.type)


def _category_ref(category: Optional[Category]) -> Optional[CategoryRef]:
    if not category:
        return None
    return CategoryRef(id=str(category.id), name=category.name, color=category.color)


def _payee_ref(payee: Optional[Payee]) -> Optional[PayeeRef]:
    if not payee:
        return None
    return PayeeRef(id=str(payee.id), name=payee.name, color=payee.color)


async def mirror_transaction_upsert(db: Session, transaction_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        await _mirror_transaction_upsert_inner(db, transaction_id)
    except Exception:
        logger.exception("mongo_sync: failed to mirror transaction %s", transaction_id)


async def _mirror_transaction_upsert_inner(db: Session, transaction_id) -> None:
    try:
        txn = db.query(Transaction).options(
            joinedload(Transaction.account),
            joinedload(Transaction.to_account),
            joinedload(Transaction.category),
            joinedload(Transaction.payee),
        ).filter(Transaction.id == transaction_id).first()
        if not txn:
            return

        doc = TransactionDocument(
            id=str(txn.id),
            user_id=str(txn.user_id),
            account_id=str(txn.account_id),
            to_account_id=str(txn.to_account_id) if txn.to_account_id else None,
            category_id=str(txn.category_id) if txn.category_id else None,
            payee_id=str(txn.payee_id) if txn.payee_id else None,
            amount=float(txn.amount),
            type=txn.type,
            description=txn.description,
            notes=txn.notes,
            date=txn.date,
            balance_after_transaction=float(txn.balance_after_transaction) if txn.balance_after_transaction is not None else None,
            to_account_balance_after=float(txn.to_account_balance_after) if txn.to_account_balance_after is not None else None,
            reward_points=float(txn.reward_points) if txn.reward_points is not None else None,
            account=_account_ref(txn.account),
            to_account=_account_ref(txn.to_account),
            category=_category_ref(txn.category),
            payee=_payee_ref(txn.payee),
            created_at=txn.created_at,
            updated_at=txn.updated_at,
        )
        existing = await TransactionDocument.get(doc.id)
        if existing:
            await existing.set(doc.model_dump(exclude={"id"}))
        else:
            await doc.insert()
    except Exception:
        logger.exception("mongo_sync: failed to mirror transaction %s", transaction_id)


async def mirror_account_transactions(db: Session, account_id) -> None:
    """Re-mirror every transaction where this account is source or destination -
    used after bulk balance-recalculation touches many rows' balance_after_transaction
    at once (e.g. recalculate_subsequent_balances), where per-row hooks aren't practical.
    """
    try:
        if not await ensure_mongo_ready():
            return
        ids = [
            row.id for row in db.query(Transaction.id).filter(
                (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id)
            ).all()
        ]
        for txn_id in ids:
            await _mirror_transaction_upsert_inner(db, txn_id)
    except Exception:
        logger.exception("mongo_sync: failed to bulk-mirror transactions for account %s", account_id)


async def mirror_transaction_delete(transaction_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        existing = await TransactionDocument.get(str(transaction_id))
        if existing:
            await existing.delete()
    except Exception:
        logger.exception("mongo_sync: failed to delete mirrored transaction %s", transaction_id)


async def _upsert_simple(doc) -> None:
    existing = await type(doc).get(doc.id)
    if existing:
        await existing.set(doc.model_dump(exclude={"id"}))
    else:
        await doc.insert()


async def mirror_account_upsert(db: Session, account_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        account = db.query(Account).filter(Account.id == account_id).first()
        if not account:
            return
        doc = AccountDocument(
            id=str(account.id),
            user_id=str(account.user_id),
            name=account.name,
            type=account.type,
            balance=float(account.balance) if account.balance is not None else 0.0,
            opening_balance=float(account.opening_balance) if account.opening_balance is not None else 0.0,
            account_number=account.account_number,
            card_number=account.card_number,
            card_expiry_month=account.card_expiry_month,
            card_expiry_year=account.card_expiry_year,
            credit_limit=float(account.credit_limit) if account.credit_limit is not None else None,
            bill_generation_date=account.bill_generation_date,
            payment_due_date=account.payment_due_date,
            interest_rate=float(account.interest_rate) if account.interest_rate is not None else None,
            status=account.status,
            opening_date=account.opening_date,
            currency=account.currency,
            created_at=account.created_at,
            updated_at=account.updated_at,
        )
        await _upsert_simple(doc)

        # Fan out the embedded display snapshot to every transaction referencing
        # this account, on either side.
        ref = _account_ref(account)
        await TransactionDocument.find({"account_id": str(account.id)}).set(
            {"$set": {"account": ref.model_dump() if ref else None}}
        )
        await TransactionDocument.find({"to_account_id": str(account.id)}).set(
            {"$set": {"to_account": ref.model_dump() if ref else None}}
        )
    except Exception:
        logger.exception("mongo_sync: failed to mirror account %s", account_id)


async def mirror_account_delete(account_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        existing = await AccountDocument.get(str(account_id))
        if existing:
            await existing.delete()
    except Exception:
        logger.exception("mongo_sync: failed to delete mirrored account %s", account_id)


async def mirror_category_upsert(db: Session, category_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            return
        doc = CategoryDocument(
            id=str(category.id),
            user_id=str(category.user_id),
            name=category.name,
            slug=category.slug,
            color=category.color,
            is_investment=bool(category.is_investment),
            created_at=category.created_at,
            updated_at=category.updated_at,
        )
        await _upsert_simple(doc)

        ref = _category_ref(category)
        await TransactionDocument.find({"category_id": str(category.id)}).set(
            {"$set": {"category": ref.model_dump() if ref else None}}
        )
    except Exception:
        logger.exception("mongo_sync: failed to mirror category %s", category_id)


async def mirror_category_delete(category_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        existing = await CategoryDocument.get(str(category_id))
        if existing:
            await existing.delete()
    except Exception:
        logger.exception("mongo_sync: failed to delete mirrored category %s", category_id)


async def mirror_payee_upsert(db: Session, payee_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        payee = db.query(Payee).filter(Payee.id == payee_id).first()
        if not payee:
            return
        doc = PayeeDocument(
            id=str(payee.id),
            user_id=str(payee.user_id),
            name=payee.name,
            slug=payee.slug,
            color=payee.color,
            created_at=payee.created_at,
            updated_at=payee.updated_at,
        )
        await _upsert_simple(doc)

        ref = _payee_ref(payee)
        await TransactionDocument.find({"payee_id": str(payee.id)}).set(
            {"$set": {"payee": ref.model_dump() if ref else None}}
        )
    except Exception:
        logger.exception("mongo_sync: failed to mirror payee %s", payee_id)


async def mirror_payee_delete(payee_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        existing = await PayeeDocument.get(str(payee_id))
        if existing:
            await existing.delete()
    except Exception:
        logger.exception("mongo_sync: failed to delete mirrored payee %s", payee_id)


async def mirror_user_upsert(db: Session, user_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return
        doc = UserDocument(
            id=str(user.id),
            email=user.email,
            password_hash=user.password_hash,
            name=user.name,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
        await _upsert_simple(doc)
    except Exception:
        logger.exception("mongo_sync: failed to mirror user %s", user_id)


async def mirror_reward_redemption_upsert(db: Session, redemption_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        row = db.query(RewardPointRedemption).filter(RewardPointRedemption.id == redemption_id).first()
        if not row:
            return
        doc = RewardPointRedemptionDocument(
            id=str(row.id),
            user_id=str(row.user_id),
            account_id=str(row.account_id),
            date=row.date,
            points_used=float(row.points_used),
            description=row.description,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        await _upsert_simple(doc)
    except Exception:
        logger.exception("mongo_sync: failed to mirror reward redemption %s", redemption_id)


async def mirror_reward_redemption_delete(redemption_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        existing = await RewardPointRedemptionDocument.get(str(redemption_id))
        if existing:
            await existing.delete()
    except Exception:
        logger.exception("mongo_sync: failed to delete mirrored reward redemption %s", redemption_id)


async def mirror_reward_bonus_upsert(db: Session, bonus_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        row = db.query(RewardPointBonus).filter(RewardPointBonus.id == bonus_id).first()
        if not row:
            return
        doc = RewardPointBonusDocument(
            id=str(row.id),
            user_id=str(row.user_id),
            account_id=str(row.account_id),
            date=row.date,
            points=float(row.points),
            description=row.description,
            source_file=row.source_file,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )
        await _upsert_simple(doc)
    except Exception:
        logger.exception("mongo_sync: failed to mirror reward bonus %s", bonus_id)


async def mirror_reward_bonus_delete(bonus_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        existing = await RewardPointBonusDocument.get(str(bonus_id))
        if existing:
            await existing.delete()
    except Exception:
        logger.exception("mongo_sync: failed to delete mirrored reward bonus %s", bonus_id)


async def mirror_learning_pattern_upsert(db: Session, pattern_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        row = db.query(UserTransactionPattern).filter(UserTransactionPattern.id == pattern_id).first()
        if not row:
            return
        doc = UserTransactionPatternDocument(
            id=str(row.id),
            user_id=str(row.user_id),
            description_keywords=list(row.description_keywords or []),
            payee_id=str(row.payee_id) if row.payee_id else None,
            category_id=str(row.category_id) if row.category_id else None,
            confidence_score=row.confidence_score,
            usage_frequency=row.usage_frequency,
            success_rate=row.success_rate,
            last_used=row.last_used,
            created_at=row.created_at,
            amount_min=row.amount_min,
            amount_max=row.amount_max,
            account_types=list(row.account_types) if row.account_types else None,
            transaction_type=row.transaction_type,
            context_data=row.context_data or {},
        )
        await _upsert_simple(doc)
    except Exception:
        logger.exception("mongo_sync: failed to mirror learning pattern %s", pattern_id)


async def mirror_learning_pattern_delete(pattern_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        existing = await UserTransactionPatternDocument.get(str(pattern_id))
        if existing:
            await existing.delete()
    except Exception:
        logger.exception("mongo_sync: failed to delete mirrored learning pattern %s", pattern_id)


async def mirror_selection_history_upsert(db: Session, selection_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        row = db.query(UserSelectionHistory).filter(UserSelectionHistory.id == selection_id).first()
        if not row:
            return
        doc = UserSelectionHistoryDocument(
            id=str(row.id),
            user_id=str(row.user_id),
            transaction_id=str(row.transaction_id) if row.transaction_id else None,
            field_type=row.field_type,
            selected_value_id=str(row.selected_value_id) if row.selected_value_id else None,
            selected_value_name=row.selected_value_name,
            transaction_description=row.transaction_description,
            transaction_amount=row.transaction_amount,
            account_type=row.account_type,
            was_suggested=bool(row.was_suggested),
            suggestion_confidence=row.suggestion_confidence,
            selection_method=row.selection_method,
            created_at=row.created_at,
        )
        await _upsert_simple(doc)
    except Exception:
        logger.exception("mongo_sync: failed to mirror selection history %s", selection_id)


async def mirror_correction_pattern_upsert(db: Session, correction_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        row = db.query(UserCorrectionPattern).filter(UserCorrectionPattern.id == correction_id).first()
        if not row:
            return
        doc = UserCorrectionPatternDocument(
            id=str(row.id),
            user_id=str(row.user_id),
            original_suggestion_type=row.original_suggestion_type,
            original_suggestion_id=str(row.original_suggestion_id) if row.original_suggestion_id else None,
            original_suggestion_name=row.original_suggestion_name,
            user_correction_id=str(row.user_correction_id) if row.user_correction_id else None,
            user_correction_name=row.user_correction_name,
            transaction_description=row.transaction_description,
            transaction_amount=row.transaction_amount,
            suggestion_confidence=row.suggestion_confidence,
            correction_frequency=row.correction_frequency,
            context_data=row.context_data or {},
            first_seen=row.first_seen,
            last_seen=row.last_seen,
        )
        await _upsert_simple(doc)
    except Exception:
        logger.exception("mongo_sync: failed to mirror correction pattern %s", correction_id)


async def mirror_learning_statistics_upsert(db: Session, user_id) -> None:
    try:
        if not await ensure_mongo_ready():
            return
        row = db.query(LearningStatistics).filter(LearningStatistics.user_id == user_id).first()
        if not row:
            return
        doc = LearningStatisticsDocument(
            id=str(row.id),
            user_id=str(row.user_id),
            total_suggestions_made=row.total_suggestions_made,
            total_suggestions_accepted=row.total_suggestions_accepted,
            total_patterns_learned=row.total_patterns_learned,
            average_confidence=row.average_confidence,
            success_rate=row.success_rate,
            last_updated=row.last_updated,
        )
        await _upsert_simple(doc)
    except Exception:
        logger.exception("mongo_sync: failed to mirror learning statistics for user %s", user_id)
