from sqlalchemy import Column, String, Date, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
from enum import Enum
import uuid

class TransactionType(str, Enum):
    DEPOSIT = "income"
    WITHDRAWAL = "expense"
    TRANSFER = "transfer"

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    to_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    payee_id = Column(UUID(as_uuid=True), ForeignKey("payees.id"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(10), nullable=False)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    date = Column(Date, nullable=False)
    balance_after_transaction = Column(Numeric(12, 2), nullable=True)  # Account balance after this transaction
    to_account_balance_after = Column(Numeric(12, 2), nullable=True)  # To-account balance after transfer (for transfers only)
    created_at = Column(DateTime, server_default=func.current_timestamp())
    updated_at = Column(DateTime, server_default=func.current_timestamp(), onupdate=func.current_timestamp())
    
    # Relationships
    user = relationship("User")
    account = relationship("Account", foreign_keys=[account_id])
    to_account = relationship("Account", foreign_keys=[to_account_id])
    payee = relationship("Payee")
    category = relationship("Category")