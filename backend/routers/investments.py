from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
from decimal import Decimal
import uuid

from database import get_db
from models.accounts import Account
from models.categories import Category
from models.users import User
from schemas.investments import (
    InvestmentAccountSummary,
    GroupATotals,
    GroupASummary,
    InvestmentCategorySummary,
    GroupBAccountSummary,
    GroupBTotals,
    GroupBSummary,
    InvestmentsSummaryResponse,
    TimelineEvent,
    InvestmentsTimelineResponse,
    InvestmentDirection,
)
from services.investment_service import (
    BALANCE_TRACKED_TYPES,
    compute_group_a,
    fetch_group_b_transactions,
    replay_all_group_b_categories,
    build_group_b_account_cashflow,
    group_a_transaction_events,
    build_timeline,
)
from utils.auth import get_current_active_user

router = APIRouter()


def _parse_ids(raw: Optional[str]) -> Optional[set]:
    if not raw:
        return None
    return {uuid.UUID(part.strip()) for part in raw.split(',') if part.strip()}


@router.get("/summary", response_model=InvestmentsSummaryResponse)
def get_investments_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    direction: InvestmentDirection = InvestmentDirection.both,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Investments summary split into two non-overlapping groups:
    - Group A: accounts of type 'investment'/'ppf' — balance-tracked, with a
      lifetime net-invested figure (including transfers) and an implied gain/loss.
    - Group B: transactions tagged with an investment category on any OTHER
      account — cash-flow only, plus a running-principal "realized gain/loss"
      heuristic (see services/investment_service.replay_category_transactions).

    account_ids/category_ids are SCOPE filters: they change which Group A accounts
    and Group B categories are included at all (and therefore feed the lifetime
    totals). start_date/end_date/direction are VIEW filters: they only trim the
    displayed period/period-direction cash-flow figures — they never affect the
    lifetime running-principal/realized-gain-loss numbers, which always reflect a
    category's full history.
    """
    account_id_filter = _parse_ids(account_ids)
    category_id_filter = _parse_ids(category_ids)

    group_a_calc = compute_group_a(db, current_user.id, account_id_filter)

    group_a_accounts = [
        InvestmentAccountSummary(
            id=r.account.id,
            name=r.account.name,
            type=r.account.type,
            balance=float(r.account.balance or Decimal('0')),
            interest_rate=float(r.account.interest_rate) if r.account.interest_rate is not None else None,
            status=r.account.status,
            opening_date=r.account.opening_date,
            net_invested=float(r.net_invested),
            implied_gain_loss=float(r.implied_gain_loss),
        )
        for r in group_a_calc.accounts
    ]
    group_a = GroupASummary(
        accounts=group_a_accounts,
        totals=GroupATotals(
            total_balance=float(group_a_calc.total_balance),
            total_net_invested=float(group_a_calc.total_net_invested),
            total_implied_gain_loss=float(group_a_calc.total_implied_gain_loss),
        ),
    )

    # Group B exclusion is defined against ALL balance-tracked accounts, regardless of the
    # account_ids scope filter — filtering only changes what's *included*, not what qualifies
    # as "another account" in the first place.
    all_group_a_account_ids = {
        a.id for a in db.query(Account.id)
        .filter(Account.user_id == current_user.id, Account.type.in_(BALANCE_TRACKED_TYPES))
        .all()
    }
    group_b_txns = fetch_group_b_transactions(db, current_user.id, all_group_a_account_ids)
    group_b_replay = replay_all_group_b_categories(group_b_txns)

    categories = (
        db.query(Category)
        .filter(Category.user_id == current_user.id, Category.is_investment.is_(True))
        .all()
    )
    categories_by_id = {c.id: c for c in categories}

    include_invested = direction in (InvestmentDirection.invested, InvestmentDirection.both)
    include_withdrawn = direction in (InvestmentDirection.withdrawn, InvestmentDirection.both)

    group_b_categories = []
    total_period_invested = Decimal('0')
    total_period_withdrawn = Decimal('0')
    total_lifetime_invested = Decimal('0')
    total_lifetime_withdrawn = Decimal('0')
    total_running_principal = Decimal('0')
    total_realized_gain_loss = Decimal('0')

    for category_id, replay in group_b_replay.items():
        if category_id_filter is not None and category_id not in category_id_filter:
            continue
        category = categories_by_id.get(category_id)
        if category is None:
            continue

        period_invested = Decimal('0')
        period_withdrawn = Decimal('0')
        lifetime_invested = Decimal('0')
        lifetime_withdrawn = Decimal('0')
        transaction_count = 0
        for ev in replay.events:
            amount = ev.amount
            in_period = (start_date is None or ev.date >= start_date) and (end_date is None or ev.date <= end_date)
            if ev.direction == 'invested':
                lifetime_invested += amount
                if include_invested and in_period:
                    period_invested += amount
                    transaction_count += 1
            else:
                lifetime_withdrawn += amount
                if include_withdrawn and in_period:
                    period_withdrawn += amount
                    transaction_count += 1

        total_period_invested += period_invested
        total_period_withdrawn += period_withdrawn
        total_lifetime_invested += lifetime_invested
        total_lifetime_withdrawn += lifetime_withdrawn
        total_running_principal += replay.running_principal
        total_realized_gain_loss += replay.realized_gain_loss

        group_b_categories.append(InvestmentCategorySummary(
            id=category_id,
            name=category.name,
            color=category.color,
            period_invested=float(period_invested),
            period_withdrawn=float(period_withdrawn),
            lifetime_invested=float(lifetime_invested),
            lifetime_withdrawn=float(lifetime_withdrawn),
            transaction_count=transaction_count,
            running_principal=float(replay.running_principal),
            realized_gain_loss=float(replay.realized_gain_loss),
        ))

    group_b_categories.sort(key=lambda c: c.lifetime_invested, reverse=True)

    scoped_group_b_txns = (
        [t for t in group_b_txns if t.category_id in category_id_filter]
        if category_id_filter is not None else group_b_txns
    )
    account_cashflow = build_group_b_account_cashflow(
        scoped_group_b_txns, account_id_filter, start_date, end_date
    )
    group_b_accounts = [
        GroupBAccountSummary(
            account_id=r.account_id,
            account_name=r.account_name,
            account_type=r.account_type,
            period_invested=float(r.period_invested if include_invested else Decimal('0')),
            period_withdrawn=float(r.period_withdrawn if include_withdrawn else Decimal('0')),
            lifetime_invested=float(r.lifetime_invested),
            lifetime_withdrawn=float(r.lifetime_withdrawn),
            transaction_count=r.transaction_count,
        )
        for r in account_cashflow
    ]

    group_b = GroupBSummary(
        categories=group_b_categories,
        accounts=group_b_accounts,
        totals=GroupBTotals(
            period_invested=float(total_period_invested),
            period_withdrawn=float(total_period_withdrawn),
            period_net=float(total_period_invested - total_period_withdrawn),
            lifetime_invested=float(total_lifetime_invested),
            lifetime_withdrawn=float(total_lifetime_withdrawn),
            total_running_principal=float(total_running_principal),
            total_realized_gain_loss=float(total_realized_gain_loss),
        ),
    )

    lifetime_profit_loss = group_a_calc.total_implied_gain_loss + total_realized_gain_loss
    currently_invested = group_a_calc.total_net_invested + total_running_principal

    return InvestmentsSummaryResponse(
        group_a=group_a,
        group_b=group_b,
        lifetime_profit_loss=float(lifetime_profit_loss),
        currently_invested=float(currently_invested),
    )


@router.get("/timeline", response_model=InvestmentsTimelineResponse)
def get_investments_timeline(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_ids: Optional[str] = Query(None, description="Comma-separated account IDs"),
    category_ids: Optional[str] = Query(None, description="Comma-separated category IDs"),
    direction: InvestmentDirection = InvestmentDirection.both,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Chronological invest/withdraw events across both groups, for the activity feed and the
    cumulative timeline chart. Filters here are VIEW filters applied to the merged, already-
    replayed event list — a category's running_principal_after/realized_gain_loss_delta always
    reflect its full lifetime history even if some events end up hidden by these filters.
    """
    account_id_filter = _parse_ids(account_ids)
    category_id_filter = _parse_ids(category_ids)

    all_group_a_account_ids = {
        a.id for a in db.query(Account.id)
        .filter(Account.user_id == current_user.id, Account.type.in_(BALANCE_TRACKED_TYPES))
        .all()
    }

    group_a_txns = group_a_transaction_events(db, current_user.id, list(all_group_a_account_ids))
    group_b_txns = fetch_group_b_transactions(db, current_user.id, all_group_a_account_ids)
    group_b_replay = replay_all_group_b_categories(group_b_txns)

    categories = (
        db.query(Category)
        .filter(Category.user_id == current_user.id, Category.is_investment.is_(True))
        .all()
    )
    categories_by_id = {c.id: c for c in categories}

    direction_value = None if direction == InvestmentDirection.both else direction.value

    events = build_timeline(
        group_a_txns,
        all_group_a_account_ids,
        group_b_replay,
        categories_by_id,
        account_ids_filter=account_id_filter,
        category_ids_filter=category_id_filter,
        direction_filter=direction_value,
        start_date=start_date,
        end_date=end_date,
    )

    response_events = [
        TimelineEvent(
            id=e.id,
            date=e.date,
            group=e.group,
            direction=e.direction,
            amount=float(e.amount),
            account_id=e.account_id,
            account_name=e.account_name,
            to_account_id=e.to_account_id,
            to_account_name=e.to_account_name,
            category_id=e.category_id,
            category_name=e.category_name,
            category_color=e.category_color,
            running_principal_after=float(e.running_principal_after) if e.running_principal_after is not None else None,
            realized_gain_loss_delta=float(e.realized_gain_loss_delta) if e.realized_gain_loss_delta is not None else None,
            description=e.description,
        )
        for e in events
    ]

    return InvestmentsTimelineResponse(events=response_events, total_count=len(response_events))
