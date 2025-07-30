from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from models.transactions import TransactionType
from .accounts import AccountResponse
from .payees import PayeeResponse
from .categories import CategoryResponse

class TransactionBase(BaseModel):
    date: date
    amount: float
    description: Optional[str] = None
    transaction_type: TransactionType
    account_id: int
    to_account_id: Optional[int] = None
    payee_id: Optional[int] = None
    category_id: Optional[int] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[float] = None
    description: Optional[str] = None
    transaction_type: Optional[TransactionType] = None
    account_id: Optional[int] = None
    to_account_id: Optional[int] = None
    payee_id: Optional[int] = None
    category_id: Optional[int] = None

class TransactionResponse(TransactionBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    account: Optional[AccountResponse] = None
    to_account: Optional[AccountResponse] = None
    payee: Optional[PayeeResponse] = None
    category: Optional[CategoryResponse] = None
    
    class Config:
        from_attributes = True