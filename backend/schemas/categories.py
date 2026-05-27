from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid

class CategoryBase(BaseModel):
    name: str
    slug: str
    color: str = '#6366f1'

class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    color: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True