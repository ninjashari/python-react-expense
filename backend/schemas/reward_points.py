from pydantic import BaseModel
from datetime import date as DateType, datetime
from typing import Optional, List
import uuid


class AccountSummary(BaseModel):
    id: uuid.UUID
    name: str
    type: str

    class Config:
        from_attributes = True


class RewardPointRedemptionBase(BaseModel):
    account_id: uuid.UUID
    date: DateType
    points_used: int
    description: Optional[str] = None


class RewardPointRedemptionCreate(RewardPointRedemptionBase):
    pass


class RewardPointRedemptionUpdate(BaseModel):
    account_id: Optional[uuid.UUID] = None
    date: Optional[DateType] = None
    points_used: Optional[int] = None
    description: Optional[str] = None


class RewardPointRedemptionResponse(RewardPointRedemptionBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    account: Optional[AccountSummary] = None

    class Config:
        from_attributes = True


class RewardPointsSummaryItem(BaseModel):
    account_id: uuid.UUID
    account_name: str
    total_earned: int
    total_redeemed: int
    net_available: int


class RewardPointsSummaryResponse(BaseModel):
    items: List[RewardPointsSummaryItem]
