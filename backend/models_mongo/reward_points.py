from datetime import date, datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class RewardPointRedemptionDocument(Document):
    id: str
    user_id: str
    account_id: str
    date: date
    points_used: float
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Settings:
        name = "reward_point_redemptions"
        indexes = [
            IndexModel([("user_id", 1)]),
            IndexModel([("account_id", 1)]),
        ]


class RewardPointBonusDocument(Document):
    id: str
    user_id: str
    account_id: str
    date: date
    points: float
    description: Optional[str] = None
    source_file: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Settings:
        name = "reward_point_bonuses"
        indexes = [
            IndexModel([("user_id", 1)]),
            IndexModel([("account_id", 1)]),
        ]
