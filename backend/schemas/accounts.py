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
    
    # Account details
    account_number: Optional[str] = None
    
    # Card details
    card_number: Optional[str] = None  # Should store only last 4 digits for security
    card_expiry_month: Optional[int] = None  # 1-12
    card_expiry_year: Optional[int] = None   # YYYY format
    
    # Credit card specific fields
    credit_limit: Optional[Decimal] = None
    bill_generation_date: Optional[int] = None
    payment_due_date: Optional[int] = None
    
    # PPF specific fields
    interest_rate: Optional[Decimal] = None  # Annual interest rate percentage
    
    status: str = 'active'
    currency: str = 'INR'

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    balance: Optional[Decimal] = None
    opening_date: Optional[date] = None
    
    # Account details
    account_number: Optional[str] = None
    
    # Card details
    card_number: Optional[str] = None
    card_expiry_month: Optional[int] = None
    card_expiry_year: Optional[int] = None
    
    # Credit card specific fields
    credit_limit: Optional[Decimal] = None
    bill_generation_date: Optional[int] = None
    payment_due_date: Optional[int] = None
    
    # PPF specific fields
    interest_rate: Optional[Decimal] = None
    
    status: Optional[str] = None

class AccountResponse(AccountBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True