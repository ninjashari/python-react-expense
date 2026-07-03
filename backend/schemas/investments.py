from pydantic import BaseModel
from datetime import date as DateType
from typing import Optional, List
import uuid


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


class GroupBTotals(BaseModel):
    period_invested: float
    period_withdrawn: float
    period_net: float
    lifetime_invested: float
    lifetime_withdrawn: float


class GroupBSummary(BaseModel):
    categories: List[InvestmentCategorySummary]
    totals: GroupBTotals


class InvestmentsSummaryResponse(BaseModel):
    group_a: GroupASummary
    group_b: GroupBSummary
