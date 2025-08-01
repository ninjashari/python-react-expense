from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from decimal import Decimal
import uuid

class AccountBase(BaseModel):
    name: str
    type: str
    balance: Decimal = Decimal('0.00')
    opening_date: Optional[date] = None
    credit_limit: Optional[Decimal] = None
    bill_generation_date: Optional[int] = None
    payment_due_date: Optional[int] = None
    status: str = 'active'
    currency: str = 'INR'

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    balance: Optional[Decimal] = None
    credit_limit: Optional[Decimal] = None
    bill_generation_date: Optional[int] = None
    payment_due_date: Optional[int] = None
    status: Optional[str] = None

class AccountResponse(AccountBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True