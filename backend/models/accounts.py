from sqlalchemy import Column, String, Date, DateTime, Numeric, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid

class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)
    balance = Column(Numeric(12, 2), default=0.00)
    created_at = Column(DateTime, server_default=func.current_timestamp())
    updated_at = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Credit card specific fields
    credit_limit = Column(Numeric(12, 2), nullable=True)
    bill_generation_date = Column(Integer, nullable=True)
    payment_due_date = Column(Integer, nullable=True)
    status = Column(String(20), default='active')
    opening_date = Column(Date, server_default=func.current_date())
    currency = Column(String(3), default='INR')
    
    # Relationships
    user = relationship("User")