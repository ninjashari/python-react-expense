from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
import uuid

from database import get_db
from models.reward_points import RewardPointRedemption, RewardPointBonus
from models.transactions import Transaction
from models.accounts import Account
from models.users import User
from schemas.reward_points import (
    RewardPointRedemptionCreate,
    RewardPointRedemptionUpdate,
    RewardPointRedemptionResponse,
    RewardPointBonusCreate,
    RewardPointBonusUpdate,
    RewardPointBonusResponse,
    RewardPointsSummaryResponse,
    RewardPointsSummaryItem,
    RewardPointHistoryItem,
)
from utils.auth import get_current_active_user

router = APIRouter()


@router.get("/summary", response_model=RewardPointsSummaryResponse)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get reward points summary per credit card account (earned vs redeemed)."""
    # Aggregate points earned from transactions grouped by credit account
    earned_rows = (
        db.query(
            Transaction.account_id,
            func.coalesce(func.sum(Transaction.reward_points), 0).label("total_earned")
        )
        .join(Account, Account.id == Transaction.account_id)
        .filter(
            Transaction.user_id == current_user.id,
            Account.type == 'credit',
            Transaction.reward_points.isnot(None)
        )
        .group_by(Transaction.account_id)
        .all()
    )
    earned_map = {str(r.account_id): float(r.total_earned) for r in earned_rows}

    # Aggregate bonus points grouped by account
    bonus_rows = (
        db.query(
            RewardPointBonus.account_id,
            func.coalesce(func.sum(RewardPointBonus.points), 0).label("total_bonus")
        )
        .filter(RewardPointBonus.user_id == current_user.id)
        .group_by(RewardPointBonus.account_id)
        .all()
    )
    bonus_map = {str(r.account_id): float(r.total_bonus) for r in bonus_rows}

    # Aggregate points redeemed grouped by account
    redeemed_rows = (
        db.query(
            RewardPointRedemption.account_id,
            func.coalesce(func.sum(RewardPointRedemption.points_used), 0).label("total_redeemed")
        )
        .filter(RewardPointRedemption.user_id == current_user.id)
        .group_by(RewardPointRedemption.account_id)
        .all()
    )
    redeemed_map = {str(r.account_id): float(r.total_redeemed) for r in redeemed_rows}

    # All credit accounts for this user
    credit_accounts = (
        db.query(Account)
        .filter(Account.user_id == current_user.id, Account.type == 'credit')
        .order_by(Account.name)
        .all()
    )

    items = []
    for acc in credit_accounts:
        acc_id = str(acc.id)
        earned = earned_map.get(acc_id, 0)
        bonus = bonus_map.get(acc_id, 0)
        redeemed = redeemed_map.get(acc_id, 0)
        items.append(RewardPointsSummaryItem(
            account_id=acc.id,
            account_name=acc.name,
            total_earned=earned,
            total_bonus=bonus,
            total_redeemed=redeemed,
            net_available=earned + bonus - redeemed,
        ))

    return RewardPointsSummaryResponse(items=items)


@router.get("/", response_model=List[RewardPointRedemptionResponse])
def get_redemptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all reward point redemptions for the current user."""
    return (
        db.query(RewardPointRedemption)
        .options(joinedload(RewardPointRedemption.account))
        .filter(RewardPointRedemption.user_id == current_user.id)
        .order_by(RewardPointRedemption.date.desc())
        .all()
    )


@router.post("/", response_model=RewardPointRedemptionResponse, status_code=status.HTTP_201_CREATED)
def create_redemption(
    redemption: RewardPointRedemptionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Record a reward point redemption for a credit card account."""
    # Validate the account belongs to user and is a credit card
    account = db.query(Account).filter(
        Account.id == redemption.account_id,
        Account.user_id == current_user.id,
        Account.type == 'credit'
    ).first()
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit card account not found"
        )

    db_obj = RewardPointRedemption(
        **redemption.model_dump(),
        user_id=current_user.id
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    # Reload with relationship
    db.refresh(db_obj)
    db_obj_with_account = (
        db.query(RewardPointRedemption)
        .options(joinedload(RewardPointRedemption.account))
        .filter(RewardPointRedemption.id == db_obj.id)
        .first()
    )
    return db_obj_with_account


@router.put("/{redemption_id}", response_model=RewardPointRedemptionResponse)
def update_redemption(
    redemption_id: uuid.UUID,
    updates: RewardPointRedemptionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a reward point redemption."""
    db_obj = db.query(RewardPointRedemption).filter(
        RewardPointRedemption.id == redemption_id,
        RewardPointRedemption.user_id == current_user.id
    ).first()
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Redemption not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(db_obj, field, value)
    db.commit()

    return (
        db.query(RewardPointRedemption)
        .options(joinedload(RewardPointRedemption.account))
        .filter(RewardPointRedemption.id == db_obj.id)
        .first()
    )


@router.delete("/{redemption_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_redemption(
    redemption_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a reward point redemption."""
    db_obj = db.query(RewardPointRedemption).filter(
        RewardPointRedemption.id == redemption_id,
        RewardPointRedemption.user_id == current_user.id
    ).first()
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Redemption not found")
    db.delete(db_obj)
    db.commit()


@router.get("/history", response_model=List[RewardPointHistoryItem])
def get_reward_points_history(
    account_id: Optional[uuid.UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Unified chronological history of reward points earned, deducted (refunds),
    and redeemed. Each row includes a per-account running balance after the event.
    """
    # Credit accounts for this user
    credit_accounts_q = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.type == 'credit'
    )
    if account_id:
        credit_accounts_q = credit_accounts_q.filter(Account.id == account_id)
    credit_accounts = credit_accounts_q.all()
    account_map = {str(acc.id): acc.name for acc in credit_accounts}
    credit_ids = [uuid.UUID(i) for i in account_map]

    # Collect raw events as plain dicts for balance calculation
    raw: list[dict] = []

    # Transactions with reward_points != 0 (positive = earned, negative = deducted/refund)
    if credit_ids:
        txns = (
            db.query(Transaction)
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.reward_points.isnot(None),
                Transaction.reward_points != 0,
                Transaction.account_id.in_(credit_ids)
            )
            .all()
        )
        for tx in txns:
            pts = float(tx.reward_points)
            raw.append({
                'date': tx.date,
                'type': 'earned' if pts > 0 else 'deducted',
                'points': abs(pts),
                'description': tx.description,
                'account_id': str(tx.account_id),
                'account_name': account_map.get(str(tx.account_id), ''),
                'source_id': str(tx.id),
                '_delta': pts,                   # signed, for balance calc
            })

    # Build a full account name map (needed for redemptions/bonuses that may span accounts
    # not in the optional account_id filter)
    all_credit_accounts = db.query(Account).filter(
        Account.user_id == current_user.id,
        Account.type == 'credit'
    ).all()
    full_account_map = {str(acc.id): acc.name for acc in all_credit_accounts}

    # Bonus points (always increase balance)
    bonuses_q = db.query(RewardPointBonus).filter(
        RewardPointBonus.user_id == current_user.id
    )
    if account_id:
        bonuses_q = bonuses_q.filter(RewardPointBonus.account_id == account_id)
    for b in bonuses_q.all():
        pts = float(b.points)
        raw.append({
            'date': b.date,
            'type': 'bonus',
            'points': pts,
            'description': b.description,
            'account_id': str(b.account_id),
            'account_name': full_account_map.get(str(b.account_id), ''),
            'source_id': str(b.id),
            '_delta': pts,
        })

    # Redemptions (always reduce balance)
    redemptions_q = db.query(RewardPointRedemption).filter(
        RewardPointRedemption.user_id == current_user.id
    )
    if account_id:
        redemptions_q = redemptions_q.filter(RewardPointRedemption.account_id == account_id)

    for r in redemptions_q.all():
        raw.append({
            'date': r.date,
            'type': 'redeemed',
            'points': float(r.points_used),
            'description': r.description,
            'account_id': str(r.account_id),
            'account_name': full_account_map.get(str(r.account_id), ''),
            'source_id': str(r.id),
            '_delta': -float(r.points_used),    # reduces balance
        })

    # Sort oldest → newest to compute per-account running balance
    raw.sort(key=lambda x: x['date'])
    account_balance: dict[str, float] = {}
    for item in raw:
        acc = item['account_id']
        account_balance[acc] = account_balance.get(acc, 0.0) + item['_delta']
        item['balance'] = round(account_balance[acc], 2)

    # Reverse to newest-first for display; build Pydantic objects
    raw.reverse()
    return [
        RewardPointHistoryItem(
            date=item['date'],
            type=item['type'],
            points=item['points'],
            description=item.get('description'),
            account_id=item['account_id'],
            account_name=item['account_name'],
            source_id=item['source_id'],
            balance=item['balance'],
        )
        for item in raw
    ]


# ── Bonus Points CRUD ─────────────────────────────────────────────────────────

@router.get("/bonuses", response_model=List[RewardPointBonusResponse])
def get_bonuses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all bonus/milestone reward point entries for the current user."""
    return (
        db.query(RewardPointBonus)
        .options(joinedload(RewardPointBonus.account))
        .filter(RewardPointBonus.user_id == current_user.id)
        .order_by(RewardPointBonus.date.desc())
        .all()
    )


@router.post("/bonuses", response_model=RewardPointBonusResponse, status_code=status.HTTP_201_CREATED)
def create_bonus(
    bonus: RewardPointBonusCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Record a bonus/milestone reward point credit for a credit card account."""
    account = db.query(Account).filter(
        Account.id == bonus.account_id,
        Account.user_id == current_user.id,
        Account.type == 'credit'
    ).first()
    if not account:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credit card account not found")

    db_obj = RewardPointBonus(**bonus.model_dump(), user_id=current_user.id)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return (
        db.query(RewardPointBonus)
        .options(joinedload(RewardPointBonus.account))
        .filter(RewardPointBonus.id == db_obj.id)
        .first()
    )


@router.put("/bonuses/{bonus_id}", response_model=RewardPointBonusResponse)
def update_bonus(
    bonus_id: uuid.UUID,
    updates: RewardPointBonusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a bonus reward point entry."""
    db_obj = db.query(RewardPointBonus).filter(
        RewardPointBonus.id == bonus_id,
        RewardPointBonus.user_id == current_user.id
    ).first()
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bonus entry not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(db_obj, field, value)
    db.commit()

    return (
        db.query(RewardPointBonus)
        .options(joinedload(RewardPointBonus.account))
        .filter(RewardPointBonus.id == db_obj.id)
        .first()
    )


@router.delete("/bonuses/{bonus_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bonus(
    bonus_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a bonus reward point entry."""
    db_obj = db.query(RewardPointBonus).filter(
        RewardPointBonus.id == bonus_id,
        RewardPointBonus.user_id == current_user.id
    ).first()
    if not db_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bonus entry not found")
    db.delete(db_obj)
    db.commit()
