from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from models.accounts import AccountType

class AccountBase(BaseModel):
    name: str
    account_type: AccountType
    balance: float = 0.0
    opening_date: date
    credit_limit: Optional[float] = None
    bill_generation_date: Optional[int] = None
    last_payment_date: Optional[date] = None

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    balance: Optional[float] = None
    credit_limit: Optional[float] = None
    bill_generation_date: Optional[int] = None
    last_payment_date: Optional[date] = None

class AccountResponse(AccountBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True