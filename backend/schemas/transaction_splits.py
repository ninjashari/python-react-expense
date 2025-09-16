from pydantic import BaseModel, validator
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
import uuid

class TransactionSplitBase(BaseModel):
    category_id: uuid.UUID
    amount: Decimal
    description: Optional[str] = None

class TransactionSplitCreate(TransactionSplitBase):
    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError('Split amount must be greater than 0')
        return v

class TransactionSplitUpdate(BaseModel):
    category_id: Optional[uuid.UUID] = None
    amount: Optional[Decimal] = None
    description: Optional[str] = None

    @validator('amount')
    def validate_amount(cls, v):
        if v is not None and v <= 0:
            raise ValueError('Split amount must be greater than 0')
        return v

class TransactionSplitResponse(TransactionSplitBase):
    id: uuid.UUID
    transaction_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Include category details in response
    category: Optional[dict] = None
    
    class Config:
        from_attributes = True

class SplitTransactionCreate(BaseModel):
    splits: List[TransactionSplitCreate]
    
    @validator('splits')
    def validate_splits(cls, v):
        if len(v) < 2:
            raise ValueError('Transaction must have at least 2 splits')
        return v

class SplitTransactionUpdate(BaseModel):
    splits: List[TransactionSplitCreate]  # Replace all splits with new ones
    
    @validator('splits')
    def validate_splits(cls, v):
        if len(v) < 2:
            raise ValueError('Transaction must have at least 2 splits')
        return v