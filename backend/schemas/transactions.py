from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional
from decimal import Decimal
import uuid

class TransactionBase(BaseModel):
    date: date
    amount: Decimal
    type: str
    description: Optional[str] = None
    notes: Optional[str] = None
    account_id: uuid.UUID
    to_account_id: Optional[uuid.UUID] = None
    payee_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    amount: Optional[Decimal] = None
    type: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    account_id: Optional[uuid.UUID] = None
    to_account_id: Optional[uuid.UUID] = None
    payee_id: Optional[uuid.UUID] = None
    category_id: Optional[uuid.UUID] = None

class TransactionResponse(TransactionBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True