from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional
from datetime import date
from decimal import Decimal

from database import get_db
from models.accounts import Account
from models.categories import Category
from models.transactions import Transaction
from models.users import User
from schemas.investments import (
    InvestmentAccountSummary,
    GroupATotals,
    GroupASummary,
    InvestmentCategorySummary,
    GroupBTotals,
    GroupBSummary,
    InvestmentsSummaryResponse,
)
from utils.auth import get_current_active_user

router = APIRouter()

BALANCE_TRACKED_TYPES = ['investment', 'ppf']


@router.get("/summary", response_model=InvestmentsSummaryResponse)
def get_investments_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Investments summary split into two non-overlapping groups:
    - Group A: accounts of type 'investment'/'ppf' — balance-tracked, with a
      lifetime net-invested figure (including transfers) and an implied gain/loss.
    - Group B: transactions tagged with an investment category on any OTHER
      account — cash-flow only, no gain/loss claim since there's no balance to
      compare against.
    """
    accounts = (
        db.query(Account)
        .filter(Account.user_id == current_user.id, Account.type.in_(BALANCE_TRACKED_TYPES))
        .all()
    )
    account_ids = [a.id for a in accounts]

    primary_leg = {}
    transfer_in_leg = {}
    if account_ids:
        primary_rows = (
            db.query(
                Transaction.account_id,
                # Only outflows count here — an 'income' transaction posted directly on a
                # balance-tracked account is interest/growth credited by the institution,
                # not principal the user contributed, so it must NOT add to net_invested
                # (it's exactly the amount the gain/loss figure is meant to capture).
                func.coalesce(func.sum(case(
                    (Transaction.type.in_(['expense', 'transfer']), -Transaction.amount),
                    else_=0
                )), 0).label("net_primary")
            )
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.account_id.in_(account_ids)
            )
            .group_by(Transaction.account_id)
            .all()
        )
        primary_leg = {r.account_id: Decimal(r.net_primary) for r in primary_rows}

        transfer_rows = (
            db.query(
                Transaction.to_account_id,
                func.coalesce(func.sum(Transaction.amount), 0).label("net_transfer_in")
            )
            .filter(
                Transaction.user_id == current_user.id,
                Transaction.to_account_id.in_(account_ids)
            )
            .group_by(Transaction.to_account_id)
            .all()
        )
        transfer_in_leg = {r.to_account_id: Decimal(r.net_transfer_in) for r in transfer_rows}

    group_a_accounts = []
    total_balance = Decimal('0')
    total_net_invested = Decimal('0')
    total_gain_loss = Decimal('0')
    for acc in accounts:
        net_invested = primary_leg.get(acc.id, Decimal('0')) + transfer_in_leg.get(acc.id, Decimal('0'))
        balance = acc.balance or Decimal('0')
        implied_gain_loss = balance - net_invested
        total_balance += balance
        total_net_invested += net_invested
        total_gain_loss += implied_gain_loss
        group_a_accounts.append(InvestmentAccountSummary(
            id=acc.id,
            name=acc.name,
            type=acc.type,
            balance=float(balance),
            interest_rate=float(acc.interest_rate) if acc.interest_rate is not None else None,
            status=acc.status,
            opening_date=acc.opening_date,
            net_invested=float(net_invested),
            implied_gain_loss=float(implied_gain_loss),
        ))
    group_a_accounts.sort(key=lambda a: a.name.lower())

    group_a = GroupASummary(
        accounts=group_a_accounts,
        totals=GroupATotals(
            total_balance=float(total_balance),
            total_net_invested=float(total_net_invested),
            total_implied_gain_loss=float(total_gain_loss),
        )
    )

    def category_rows(with_period: bool):
        q = (
            db.query(
                Category.id,
                Category.name,
                Category.color,
                func.coalesce(func.sum(case((Transaction.type == 'income', Transaction.amount), else_=0)), 0).label("invested"),
                func.coalesce(func.sum(case((Transaction.type == 'expense', Transaction.amount), else_=0)), 0).label("withdrawn"),
                func.count(Transaction.id).label("transaction_count"),
            )
            .join(Transaction, Transaction.category_id == Category.id)
            .filter(
                Transaction.user_id == current_user.id,
                Category.is_investment.is_(True),
                Transaction.type.in_(['income', 'expense']),
            )
        )
        if account_ids:
            q = q.filter(~Transaction.account_id.in_(account_ids))
        if with_period and start_date:
            q = q.filter(Transaction.date >= start_date)
        if with_period and end_date:
            q = q.filter(Transaction.date <= end_date)
        return q.group_by(Category.id, Category.name, Category.color).all()

    lifetime_rows = category_rows(with_period=False)
    period_rows = category_rows(with_period=True)
    period_map = {r.id: r for r in period_rows}

    group_b_categories = []
    total_period_invested = Decimal('0')
    total_period_withdrawn = Decimal('0')
    total_lifetime_invested = Decimal('0')
    total_lifetime_withdrawn = Decimal('0')
    for row in lifetime_rows:
        period_row = period_map.get(row.id)
        period_invested = Decimal(period_row.invested) if period_row else Decimal('0')
        period_withdrawn = Decimal(period_row.withdrawn) if period_row else Decimal('0')
        lifetime_invested = Decimal(row.invested)
        lifetime_withdrawn = Decimal(row.withdrawn)
        total_period_invested += period_invested
        total_period_withdrawn += period_withdrawn
        total_lifetime_invested += lifetime_invested
        total_lifetime_withdrawn += lifetime_withdrawn
        group_b_categories.append(InvestmentCategorySummary(
            id=row.id,
            name=row.name,
            color=row.color,
            period_invested=float(period_invested),
            period_withdrawn=float(period_withdrawn),
            lifetime_invested=float(lifetime_invested),
            lifetime_withdrawn=float(lifetime_withdrawn),
            transaction_count=int(period_row.transaction_count) if period_row else 0,
        ))
    group_b_categories.sort(key=lambda c: c.lifetime_invested, reverse=True)

    group_b = GroupBSummary(
        categories=group_b_categories,
        totals=GroupBTotals(
            period_invested=float(total_period_invested),
            period_withdrawn=float(total_period_withdrawn),
            period_net=float(total_period_invested - total_period_withdrawn),
            lifetime_invested=float(total_lifetime_invested),
            lifetime_withdrawn=float(total_lifetime_withdrawn),
        )
    )

    return InvestmentsSummaryResponse(group_a=group_a, group_b=group_b)
