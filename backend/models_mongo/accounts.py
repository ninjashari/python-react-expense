from datetime import date, datetime
from typing import Optional

from beanie import Document
from pymongo import IndexModel


class AccountDocument(Document):
    id: str
    user_id: str
    name: str
    type: str
    balance: float = 0.0
    opening_balance: float = 0.0
    account_number: Optional[str] = None
    card_number: Optional[str] = None
    card_expiry_month: Optional[int] = None
    card_expiry_year: Optional[int] = None
    credit_limit: Optional[float] = None
    bill_generation_date: Optional[int] = None
    payment_due_date: Optional[int] = None
    interest_rate: Optional[float] = None
    status: str = "active"
    opening_date: Optional[date] = None
    currency: str = "INR"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Settings:
        name = "accounts"
        indexes = [
            IndexModel([("user_id", 1)]),
        ]
