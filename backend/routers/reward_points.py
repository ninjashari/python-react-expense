from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
import uuid
import io
import pandas as pd

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


@router.get("/export")
def export_reward_points(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export all reward points data (earned, bonuses, redemptions) to a multi-sheet Excel file."""
    try:
        # Map of credit account id -> name for the current user
        credit_accounts = (
            db.query(Account)
            .filter(Account.user_id == current_user.id, Account.type == 'credit')
            .all()
        )
        account_map = {acc.id: acc.name for acc in credit_accounts}
        credit_ids = list(account_map.keys())

        # Earned points (from transactions on credit accounts, non-zero reward_points)
        earned_data = []
        if credit_ids:
            txns = (
                db.query(Transaction)
                .filter(
                    Transaction.user_id == current_user.id,
                    Transaction.reward_points.isnot(None),
                    Transaction.reward_points != 0,
                    Transaction.account_id.in_(credit_ids)
                )
                .order_by(Transaction.date)
                .all()
            )
            for tx in txns:
                earned_data.append({
                    'Date': tx.date.strftime('%Y-%m-%d') if tx.date else '',
                    'Account': account_map.get(tx.account_id, ''),
                    'Points': float(tx.reward_points),
                    'Description': tx.description or '',
                })

        # Bonus points
        bonuses = (
            db.query(RewardPointBonus)
            .filter(RewardPointBonus.user_id == current_user.id)
            .order_by(RewardPointBonus.date)
            .all()
        )
        bonus_data = []
        for b in bonuses:
            bonus_data.append({
                'Date': b.date.strftime('%Y-%m-%d') if b.date else '',
                'Account': account_map.get(b.account_id, ''),
                'Points': float(b.points),
                'Description': b.description or '',
                'Source File': b.source_file or '',
            })

        # Redemptions
        redemptions = (
            db.query(RewardPointRedemption)
            .filter(RewardPointRedemption.user_id == current_user.id)
            .order_by(RewardPointRedemption.date)
            .all()
        )
        redemption_data = []
        for r in redemptions:
            redemption_data.append({
                'Date': r.date.strftime('%Y-%m-%d') if r.date else '',
                'Account': account_map.get(r.account_id, ''),
                'Points Used': float(r.points_used),
                'Description': r.description or '',
            })

        if not earned_data and not bonus_data and not redemption_data:
            raise HTTPException(status_code=404, detail="No reward points data found to export")

        # Build a multi-sheet Excel workbook
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            pd.DataFrame(earned_data, columns=['Date', 'Account', 'Points', 'Description']) \
                .to_excel(writer, index=False, sheet_name='Earned')
            pd.DataFrame(bonus_data, columns=['Date', 'Account', 'Points', 'Description', 'Source File']) \
                .to_excel(writer, index=False, sheet_name='Bonuses')
            pd.DataFrame(redemption_data, columns=['Date', 'Account', 'Points Used', 'Description']) \
                .to_excel(writer, index=False, sheet_name='Redemptions')

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue()),
            media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={"Content-Disposition": "attachment; filename=reward_points_export.xlsx"}
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export reward points: {str(e)}")


def _parse_date(value):
    """Parse a date cell that may be a string or a pandas/datetime value."""
    if isinstance(value, str):
        return datetime.strptime(value.strip(), '%Y-%m-%d').date()
    if hasattr(value, 'date'):
        return value.date()
    return value


@router.post("/import")
def import_reward_points(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Import reward points data (bonuses and redemptions) from an Excel/CSV file.

    Excel files may contain 'Bonuses' and/or 'Redemptions' sheets (as produced by
    the export). CSV files are auto-detected as bonuses or redemptions based on
    their columns ('Points Used' => redemptions, 'Points' => bonuses).

    Earned points are derived from transactions and are not imported here.
    Accounts are matched by name (must be an existing credit card account).
    """
    try:
        if not file.filename.lower().endswith(('.xlsx', '.xls', '.csv')):
            raise HTTPException(
                status_code=400,
                detail="Invalid file format. Only Excel (.xlsx, .xls) and CSV files are supported."
            )

        content = file.file.read()

        # Build the set of sheets to process: { 'bonuses': df, 'redemptions': df }
        sheets: dict[str, pd.DataFrame] = {}
        try:
            if file.filename.lower().endswith('.csv'):
                df = pd.read_csv(io.StringIO(content.decode('utf-8')))
                if 'Points Used' in df.columns:
                    sheets['redemptions'] = df
                elif 'Points' in df.columns:
                    sheets['bonuses'] = df
                else:
                    raise HTTPException(
                        status_code=400,
                        detail="CSV must contain a 'Points' (bonuses) or 'Points Used' (redemptions) column."
                    )
            else:
                excel = pd.read_excel(io.BytesIO(content), sheet_name=None)
                for name, df in excel.items():
                    key = name.strip().lower()
                    if key == 'bonuses':
                        sheets['bonuses'] = df
                    elif key == 'redemptions':
                        sheets['redemptions'] = df
                if not sheets:
                    raise HTTPException(
                        status_code=400,
                        detail="Excel file must contain a 'Bonuses' and/or 'Redemptions' sheet."
                    )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read file: {str(e)}. Please ensure the file is not corrupted."
            )

        # Map credit account names (lowercased) -> account
        credit_accounts = (
            db.query(Account)
            .filter(Account.user_id == current_user.id, Account.type == 'credit')
            .all()
        )
        account_by_name = {acc.name.strip().lower(): acc for acc in credit_accounts}

        created_redemptions = 0
        created_bonuses = 0
        skipped = 0
        errors: list[str] = []

        # ── Redemptions ────────────────────────────────────────────────
        if 'redemptions' in sheets:
            df = sheets['redemptions']
            for col in ('Account', 'Date', 'Points Used'):
                if col not in df.columns:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Redemptions sheet missing required column: '{col}'"
                    )
            for index, row in df.iterrows():
                try:
                    if pd.isna(row.get('Account')) or pd.isna(row.get('Points Used')):
                        continue
                    account = account_by_name.get(str(row['Account']).strip().lower())
                    if not account:
                        errors.append(f"Redemptions row {index + 2}: Credit account '{row['Account']}' not found")
                        continue
                    rec_date = _parse_date(row['Date'])
                    points = float(row['Points Used'])
                    description = None
                    if 'Description' in row and pd.notna(row['Description']):
                        description = str(row['Description']).strip() or None

                    # Skip duplicates (same account/date/points/description)
                    exists = db.query(RewardPointRedemption).filter(
                        RewardPointRedemption.user_id == current_user.id,
                        RewardPointRedemption.account_id == account.id,
                        RewardPointRedemption.date == rec_date,
                        RewardPointRedemption.points_used == points,
                    ).first()
                    if exists:
                        skipped += 1
                        continue

                    db.add(RewardPointRedemption(
                        user_id=current_user.id,
                        account_id=account.id,
                        date=rec_date,
                        points_used=points,
                        description=description,
                    ))
                    created_redemptions += 1
                except Exception as row_error:
                    errors.append(f"Redemptions row {index + 2}: {str(row_error)}")
                    continue

        # ── Bonuses ────────────────────────────────────────────────────
        if 'bonuses' in sheets:
            df = sheets['bonuses']
            for col in ('Account', 'Date', 'Points'):
                if col not in df.columns:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Bonuses sheet missing required column: '{col}'"
                    )
            for index, row in df.iterrows():
                try:
                    if pd.isna(row.get('Account')) or pd.isna(row.get('Points')):
                        continue
                    account = account_by_name.get(str(row['Account']).strip().lower())
                    if not account:
                        errors.append(f"Bonuses row {index + 2}: Credit account '{row['Account']}' not found")
                        continue
                    rec_date = _parse_date(row['Date'])
                    points = float(row['Points'])
                    description = None
                    if 'Description' in row and pd.notna(row['Description']):
                        description = str(row['Description']).strip() or None
                    source_file = None
                    if 'Source File' in row and pd.notna(row['Source File']):
                        source_file = str(row['Source File']).strip() or None

                    exists = db.query(RewardPointBonus).filter(
                        RewardPointBonus.user_id == current_user.id,
                        RewardPointBonus.account_id == account.id,
                        RewardPointBonus.date == rec_date,
                        RewardPointBonus.points == points,
                    ).first()
                    if exists:
                        skipped += 1
                        continue

                    db.add(RewardPointBonus(
                        user_id=current_user.id,
                        account_id=account.id,
                        date=rec_date,
                        points=points,
                        description=description,
                        source_file=source_file,
                    ))
                    created_bonuses += 1
                except Exception as row_error:
                    errors.append(f"Bonuses row {index + 2}: {str(row_error)}")
                    continue

        db.commit()

        return {
            "message": "Import completed successfully",
            "created_redemptions": created_redemptions,
            "created_bonuses": created_bonuses,
            "skipped_count": skipped,
            "error_count": len(errors),
            "errors": errors[:10],
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to import reward points: {str(e)}")


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
