"""
Business logic for the Investments page.

Two disjoint tracking mechanisms exist in this app, referred to as Group A and Group B:

- Group A: accounts of type 'investment'/'ppf'. These carry a real tracked `balance`, so a
  genuine (if still "implied") gain/loss can be computed as balance minus net contributions.
- Group B: transactions tagged with an `is_investment` category on any OTHER account (e.g. a
  mutual fund SIP paid out of a checking account). There is no tracked market value here, only
  cash flow (money going out to invest, money coming back as withdrawals/dividends/redemptions).
  A real gain/loss is impossible to compute for Group B — see `replay_category_transactions`
  for the realized-gain heuristic used instead.
"""
from dataclasses import dataclass, field
from decimal import Decimal
from datetime import date as DateType
from typing import Dict, List, Optional, Set, Sequence, Any
from collections import defaultdict
import uuid

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case

from models.accounts import Account
from models.categories import Category
from models.transactions import Transaction

BALANCE_TRACKED_TYPES = ['investment', 'ppf']


# ---------------------------------------------------------------------------
# Group B realized-gain replay
# ---------------------------------------------------------------------------

@dataclass
class ReplayTxn:
    """Minimal duck-typed input to the replay algorithm — decoupled from the ORM so it's
    directly unit-testable without a database."""
    id: Any
    date: DateType
    direction: str  # 'invested' | 'withdrawn'
    amount: Decimal
    account_id: Any
    account_name: str


@dataclass
class CategoryReplayEvent:
    transaction_id: Any
    date: DateType
    direction: str
    amount: Decimal
    account_id: Any
    account_name: str
    running_principal_after: Decimal
    realized_gain_loss_delta: Decimal


@dataclass
class CategoryReplayResult:
    running_principal: Decimal = Decimal('0')
    realized_gain_loss: Decimal = Decimal('0')
    events: List[CategoryReplayEvent] = field(default_factory=list)


def replay_category_transactions(txns: Sequence[ReplayTxn]) -> CategoryReplayResult:
    """
    Replays one category's lifetime invest/withdraw events, in ascending date order, using a
    running-principal heuristic (there's no per-holding cost basis or market value to compute a
    real gain/loss from, only cash flow):

        invested          -> running_principal += amount
        withdrawn, amount <= running_principal -> running_principal -= amount   (plain return of
                                                    principal — no gain/loss signal either way)
        withdrawn, amount >  running_principal -> the excess beyond all deployed principal is
                                                    realized profit; running_principal resets to 0
                                                    so a later investment starts a fresh cycle
                                                    untouched by this one.

    NOTE: this can only ever realize a PROFIT, never a loss. A withdrawal that's smaller than the
    outstanding principal is indistinguishable, in a cash-only model, from "giving up" on money
    still notionally invested vs. a partial withdrawal that leaves the rest to keep growing — so
    no loss is ever inferred. This asymmetry is intentional; don't "fix" it into detecting losses,
    that would require inventing information this data model doesn't have.

    `txns` MUST already contain a category's FULL lifetime transaction history — replaying a
    date- or account-filtered subset would silently corrupt running_principal (e.g. dropping an
    early investment would make a later withdrawal look like profit that isn't real).
    """
    running_principal = Decimal('0')
    realized_gain_loss = Decimal('0')
    events: List[CategoryReplayEvent] = []

    for txn in sorted(txns, key=lambda t: t.date):
        delta = Decimal('0')
        if txn.direction == 'invested':
            running_principal += txn.amount
        elif txn.direction == 'withdrawn':
            if txn.amount <= running_principal:
                running_principal -= txn.amount
            else:
                delta = txn.amount - running_principal
                realized_gain_loss += delta
                running_principal = Decimal('0')

        events.append(CategoryReplayEvent(
            transaction_id=txn.id,
            date=txn.date,
            direction=txn.direction,
            amount=txn.amount,
            account_id=txn.account_id,
            account_name=txn.account_name,
            running_principal_after=running_principal,
            realized_gain_loss_delta=delta,
        ))

    return CategoryReplayResult(
        running_principal=running_principal,
        realized_gain_loss=realized_gain_loss,
        events=events,
    )


def fetch_group_b_transactions(db: Session, user_id, group_a_account_ids: Set[uuid.UUID]) -> List[Transaction]:
    """All of a user's Group B transactions (any account, any date) — deliberately unfiltered by
    date/account/direction so callers doing a replay always see a category's full history."""
    q = (
        db.query(Transaction)
        .options(joinedload(Transaction.account), joinedload(Transaction.category))
        .join(Category, Transaction.category_id == Category.id)
        .filter(
            Transaction.user_id == user_id,
            Category.is_investment.is_(True),
            Transaction.type.in_(['income', 'expense']),
        )
    )
    if group_a_account_ids:
        q = q.filter(~Transaction.account_id.in_(group_a_account_ids))
    return q.order_by(Transaction.date.asc()).all()


def replay_all_group_b_categories(txns: List[Transaction]) -> Dict[uuid.UUID, CategoryReplayResult]:
    """Groups a user's Group B transactions (fetched via `fetch_group_b_transactions`) by
    category and replays each independently."""
    by_category: Dict[uuid.UUID, List[ReplayTxn]] = defaultdict(list)
    for t in txns:
        direction = 'invested' if t.type == 'expense' else 'withdrawn'
        by_category[t.category_id].append(ReplayTxn(
            id=t.id,
            date=t.date,
            direction=direction,
            amount=Decimal(t.amount),
            account_id=t.account_id,
            account_name=t.account.name if t.account else '',
        ))

    return {
        category_id: replay_category_transactions(category_txns)
        for category_id, category_txns in by_category.items()
    }


# ---------------------------------------------------------------------------
# Group A (balance-tracked accounts)
# ---------------------------------------------------------------------------

@dataclass
class GroupAAccountResult:
    account: Account
    net_invested: Decimal
    implied_gain_loss: Decimal


@dataclass
class GroupACalcResult:
    accounts: List[GroupAAccountResult]
    total_balance: Decimal
    total_net_invested: Decimal
    total_implied_gain_loss: Decimal


def compute_group_a(
    db: Session, user_id, account_id_filter: Optional[Set[uuid.UUID]] = None
) -> GroupACalcResult:
    q = db.query(Account).filter(Account.user_id == user_id, Account.type.in_(BALANCE_TRACKED_TYPES))
    if account_id_filter is not None:
        q = q.filter(Account.id.in_(account_id_filter))
    accounts = q.all()
    account_ids = [a.id for a in accounts]

    primary_leg: Dict[uuid.UUID, Decimal] = {}
    transfer_in_leg: Dict[uuid.UUID, Decimal] = {}
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
            .filter(Transaction.user_id == user_id, Transaction.account_id.in_(account_ids))
            .group_by(Transaction.account_id)
            .all()
        )
        primary_leg = {r.account_id: Decimal(r.net_primary) for r in primary_rows}

        transfer_rows = (
            db.query(
                Transaction.to_account_id,
                func.coalesce(func.sum(Transaction.amount), 0).label("net_transfer_in")
            )
            .filter(Transaction.user_id == user_id, Transaction.to_account_id.in_(account_ids))
            .group_by(Transaction.to_account_id)
            .all()
        )
        transfer_in_leg = {r.to_account_id: Decimal(r.net_transfer_in) for r in transfer_rows}

    results = []
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
        results.append(GroupAAccountResult(account=acc, net_invested=net_invested, implied_gain_loss=implied_gain_loss))

    results.sort(key=lambda r: r.account.name.lower())

    return GroupACalcResult(
        accounts=results,
        total_balance=total_balance,
        total_net_invested=total_net_invested,
        total_implied_gain_loss=total_gain_loss,
    )


def group_a_transaction_events(db: Session, user_id, account_ids: List[uuid.UUID]) -> List[Transaction]:
    """Raw transaction rows feeding Group A's timeline: transfers into a Group A account
    ('invested') and expense/transfer outflows on a Group A account ('withdrawn')."""
    if not account_ids:
        return []
    return (
        db.query(Transaction)
        .options(joinedload(Transaction.account), joinedload(Transaction.to_account))
        .filter(
            Transaction.user_id == user_id,
            (Transaction.to_account_id.in_(account_ids)) |
            (Transaction.account_id.in_(account_ids) & Transaction.type.in_(['expense', 'transfer']))
        )
        .order_by(Transaction.date.asc())
        .all()
    )


# ---------------------------------------------------------------------------
# Group B — by funding account (cash-flow only, no realized gain attribution)
# ---------------------------------------------------------------------------

@dataclass
class GroupBAccountResult:
    account_id: uuid.UUID
    account_name: str
    account_type: str
    period_invested: Decimal
    period_withdrawn: Decimal
    lifetime_invested: Decimal
    lifetime_withdrawn: Decimal
    transaction_count: int


def build_group_b_account_cashflow(
    txns: List[Transaction],
    account_ids_filter: Optional[Set[uuid.UUID]],
    start_date: Optional[DateType],
    end_date: Optional[DateType],
) -> List[GroupBAccountResult]:
    """Aggregates the same raw Group B transactions by funding account instead of category.
    This is cash-flow only (invested/withdrawn totals) — attributing a realized gain to a single
    funding account is ambiguous when a category's invest and withdraw legs land in different
    accounts, so no gain/loss figure is produced here."""
    by_account: Dict[uuid.UUID, GroupBAccountResult] = {}
    for t in txns:
        if account_ids_filter is not None and t.account_id not in account_ids_filter:
            continue
        if t.account_id not in by_account:
            by_account[t.account_id] = GroupBAccountResult(
                account_id=t.account_id,
                account_name=t.account.name if t.account else '',
                account_type=t.account.type if t.account else '',
                period_invested=Decimal('0'),
                period_withdrawn=Decimal('0'),
                lifetime_invested=Decimal('0'),
                lifetime_withdrawn=Decimal('0'),
                transaction_count=0,
            )
        row = by_account[t.account_id]
        amount = Decimal(t.amount)
        in_period = (start_date is None or t.date >= start_date) and (end_date is None or t.date <= end_date)
        if t.type == 'expense':
            row.lifetime_invested += amount
            if in_period:
                row.period_invested += amount
                row.transaction_count += 1
        elif t.type == 'income':
            row.lifetime_withdrawn += amount
            if in_period:
                row.period_withdrawn += amount
                row.transaction_count += 1

    return sorted(by_account.values(), key=lambda r: r.account_name.lower())


# ---------------------------------------------------------------------------
# Combined timeline (Group A + Group B events, merged)
# ---------------------------------------------------------------------------

@dataclass
class TimelineEventResult:
    id: Any
    date: DateType
    group: str  # 'A' | 'B'
    direction: str  # 'invested' | 'withdrawn'
    amount: Decimal
    account_id: uuid.UUID
    account_name: str
    to_account_id: Optional[uuid.UUID] = None
    to_account_name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    running_principal_after: Optional[Decimal] = None
    realized_gain_loss_delta: Optional[Decimal] = None
    description: Optional[str] = None


def build_timeline(
    group_a_txns: List[Transaction],
    group_a_account_ids: Set[uuid.UUID],
    group_b_replay: Dict[uuid.UUID, CategoryReplayResult],
    categories_by_id: Dict[uuid.UUID, Category],
    *,
    account_ids_filter: Optional[Set[uuid.UUID]] = None,
    category_ids_filter: Optional[Set[uuid.UUID]] = None,
    direction_filter: Optional[str] = None,  # 'invested' | 'withdrawn' | None (=both)
    start_date: Optional[DateType] = None,
    end_date: Optional[DateType] = None,
) -> List[TimelineEventResult]:
    events: List[TimelineEventResult] = []

    for t in group_a_txns:
        if t.to_account_id in group_a_account_ids:
            direction = 'invested'
            account_id, account_name = t.to_account_id, t.to_account.name if t.to_account else ''
        else:
            direction = 'withdrawn'
            account_id, account_name = t.account_id, t.account.name if t.account else ''
        events.append(TimelineEventResult(
            id=t.id,
            date=t.date,
            group='A',
            direction=direction,
            amount=Decimal(t.amount),
            account_id=account_id,
            account_name=account_name,
            to_account_id=t.to_account_id if direction == 'invested' else None,
            to_account_name=(t.to_account.name if direction == 'invested' and t.to_account else None),
            description=t.description,
        ))

    for category_id, result in group_b_replay.items():
        category = categories_by_id.get(category_id)
        for ev in result.events:
            events.append(TimelineEventResult(
                id=ev.transaction_id,
                date=ev.date,
                group='B',
                direction=ev.direction,
                amount=ev.amount,
                account_id=ev.account_id,
                account_name=ev.account_name,
                category_id=category_id,
                category_name=category.name if category else None,
                category_color=category.color if category else None,
                running_principal_after=ev.running_principal_after,
                realized_gain_loss_delta=ev.realized_gain_loss_delta,
            ))

    events.sort(key=lambda e: (e.date, str(e.id)))

    def keep(e: TimelineEventResult) -> bool:
        if account_ids_filter is not None:
            matches_account = e.account_id in account_ids_filter or (e.to_account_id is not None and e.to_account_id in account_ids_filter)
            if not matches_account:
                return False
        # Category selection is a Group-B-only concept — Group A events (no category) pass
        # through untouched rather than being hidden by an unrelated filter.
        if category_ids_filter is not None and e.group == 'B' and e.category_id not in category_ids_filter:
            return False
        if direction_filter and e.direction != direction_filter:
            return False
        if start_date and e.date < start_date:
            return False
        if end_date and e.date > end_date:
            return False
        return True

    return [e for e in events if keep(e)]
