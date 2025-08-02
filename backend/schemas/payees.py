from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

class PayeeBase(BaseModel):
    name: str
    slug: str

class PayeeCreate(BaseModel):
    name: str

class PayeeUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None

class PayeeResponse(PayeeBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True