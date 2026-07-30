from pydantic import BaseModel
from datetime import date as DateType
from typing import Optional, List
from enum import Enum
import uuid


class InvestmentDirection(str, Enum):
    invested = "invested"
    withdrawn = "withdrawn"
    both = "both"


class InvestmentAccountSummary(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    balance: float
    interest_rate: Optional[float] = None
    status: str
    opening_date: Optional[DateType] = None
    net_invested: float
    implied_gain_loss: float


class GroupATotals(BaseModel):
    total_balance: float
    total_net_invested: float
    total_implied_gain_loss: float


class GroupASummary(BaseModel):
    accounts: List[InvestmentAccountSummary]
    totals: GroupATotals


class InvestmentCategorySummary(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    period_invested: float
    period_withdrawn: float
    lifetime_invested: float
    lifetime_withdrawn: float
    transaction_count: int
    # Running-principal replay results — see services/investment_service.py for the algorithm.
    # Always lifetime figures, unaffected by the start_date/end_date view filter.
    running_principal: float
    realized_gain_loss: float


class GroupBAccountSummary(BaseModel):
    account_id: uuid.UUID
    account_name: str
    account_type: str
    period_invested: float
    period_withdrawn: float
    lifetime_invested: float
    lifetime_withdrawn: float
    transaction_count: int


class GroupBTotals(BaseModel):
    period_invested: float
    period_withdrawn: float
    period_net: float
    lifetime_invested: float
    lifetime_withdrawn: float
    total_running_principal: float
    total_realized_gain_loss: float


class GroupBSummary(BaseModel):
    categories: List[InvestmentCategorySummary]
    accounts: List[GroupBAccountSummary]
    totals: GroupBTotals


class InvestmentsSummaryResponse(BaseModel):
    group_a: GroupASummary
    group_b: GroupBSummary
    # Combined headline figures: group_a totals + group_b running-principal totals.
    # Always lifetime figures, unaffected by the start_date/end_date view filter.
    lifetime_profit_loss: float
    currently_invested: float


class TimelineEvent(BaseModel):
    id: uuid.UUID
    date: DateType
    group: str  # 'A' | 'B'
    direction: str  # 'invested' | 'withdrawn'
    amount: float
    account_id: uuid.UUID
    account_name: str
    to_account_id: Optional[uuid.UUID] = None
    to_account_name: Optional[str] = None
    category_id: Optional[uuid.UUID] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    running_principal_after: Optional[float] = None
    realized_gain_loss_delta: Optional[float] = None
    description: Optional[str] = None


class InvestmentsTimelineResponse(BaseModel):
    events: List[TimelineEvent]
    total_count: int
