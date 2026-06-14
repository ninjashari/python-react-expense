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
    points_used: float
    description: Optional[str] = None


class RewardPointRedemptionCreate(RewardPointRedemptionBase):
    pass


class RewardPointRedemptionUpdate(BaseModel):
    account_id: Optional[uuid.UUID] = None
    date: Optional[DateType] = None
    points_used: Optional[float] = None
    description: Optional[str] = None


class RewardPointRedemptionResponse(RewardPointRedemptionBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None
    account: Optional[AccountSummary] = None

    class Config:
        from_attributes = True


class RewardPointBonusBase(BaseModel):
    account_id: uuid.UUID
    date: DateType
    points: float
    description: Optional[str] = None


class RewardPointBonusCreate(RewardPointBonusBase):
    pass


class RewardPointBonusUpdate(BaseModel):
    account_id: Optional[uuid.UUID] = None
    date: Optional[DateType] = None
    points: Optional[float] = None
    description: Optional[str] = None


class RewardPointBonusResponse(RewardPointBonusBase):
    id: uuid.UUID
    user_id: uuid.UUID
    source_file: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    account: Optional[AccountSummary] = None

    class Config:
        from_attributes = True


class RewardPointsSummaryItem(BaseModel):
    account_id: uuid.UUID
    account_name: str
    total_earned: float
    total_bonus: float
    total_redeemed: float
    net_available: float


class RewardPointsSummaryResponse(BaseModel):
    items: List[RewardPointsSummaryItem]


class RewardPointHistoryItem(BaseModel):
    date: DateType
    type: str          # 'earned' | 'deducted' | 'redeemed'
    points: float      # always positive; type indicates direction
    description: Optional[str] = None
    account_id: str
    account_name: str
    source_id: str     # transaction_id or redemption_id
    balance: float     # per-account running balance after this event
