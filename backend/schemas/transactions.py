from pydantic import BaseModel
from datetime import date as DateType, datetime
from typing import Optional, List
from decimal import Decimal
import uuid

# Import related schemas
class AccountSummary(BaseModel):
    id: uuid.UUID
    name: str
    type: str
    
    class Config:
        from_attributes = True

class PayeeSummary(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    
    class Config:
        from_attributes = True

class CategorySummary(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    color: str
    
    class Config:
        from_attributes = True

class TransactionBase(BaseModel):
    date: DateType
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
    date: Optional[DateType] = None
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
    
    # Related objects
    account: Optional[AccountSummary] = None
    to_account: Optional[AccountSummary] = None
    payee: Optional[PayeeSummary] = None
    category: Optional[CategorySummary] = None
    
    class Config:
        from_attributes = True

class PaginatedTransactionsResponse(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    size: int
    pages: int

class TransactionSummary(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    net_amount: Decimal
    transaction_count: int