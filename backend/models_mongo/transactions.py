from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import BaseModel
from pymongo import IndexModel


class AccountRef(BaseModel):
    """Snapshot of an account, embedded in a transaction for read-heavy display."""
    id: str
    name: str
    type: Optional[str] = None


class CategoryRef(BaseModel):
    id: str
    name: str
    color: Optional[str] = None


class PayeeRef(BaseModel):
    id: str
    name: str
    color: Optional[str] = None


class TransactionDocument(Document):
    id: str
    user_id: str
    account_id: str
    to_account_id: Optional[str] = None
    category_id: Optional[str] = None
    payee_id: Optional[str] = None
    amount: float
    type: str
    description: Optional[str] = None
    notes: Optional[str] = None
    date: datetime  # matches Transaction.date (Postgres DATETIME, not DATE) - see models/transactions.py
    balance_after_transaction: Optional[float] = None
    to_account_balance_after: Optional[float] = None
    reward_points: Optional[float] = None

    # Embedded display snapshots (read-heavy data, denormalized on purpose).
    # Raw *_id fields above stay authoritative for aggregation/reports.
    account: Optional[AccountRef] = None
    to_account: Optional[AccountRef] = None
    category: Optional[CategoryRef] = None
    payee: Optional[PayeeRef] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Settings:
        name = "transactions"
        indexes = [
            IndexModel([("user_id", 1), ("date", -1)]),
            IndexModel([("user_id", 1), ("account_id", 1), ("date", -1)]),
            IndexModel([("user_id", 1), ("category_id", 1)]),
            IndexModel([("user_id", 1), ("payee_id", 1)]),
            IndexModel([("user_id", 1), ("to_account_id", 1)]),
            IndexModel([("user_id", 1), ("type", 1)]),
        ]
