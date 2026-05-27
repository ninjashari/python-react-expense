from sqlalchemy import Column, String, DateTime, Float, Integer, JSON, ForeignKey, Text, Boolean, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import uuid
from datetime import datetime


class UserTransactionPattern(Base):
    """Stores learned patterns from user's transaction behavior"""
    __tablename__ = 'user_transaction_patterns'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # Pattern Recognition Data
    description_keywords = Column(ARRAY(String), nullable=False)  # Keywords that trigger this pattern
    payee_id = Column(UUID(as_uuid=True), ForeignKey('payees.id'), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey('categories.id'), nullable=True)
    
    # Learning Metrics
    confidence_score = Column(Float, default=0.1)  # Starts low, grows with usage
    usage_frequency = Column(Integer, default=1)  # How many times this pattern was used
    success_rate = Column(Float, default=1.0)  # % of times user accepted this suggestion
    last_used = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Context Awareness
    amount_min = Column(Float, nullable=True)  # Amount range where this pattern applies
    amount_max = Column(Float, nullable=True)
    account_types = Column(ARRAY(String), nullable=True)  # Account types where this works
    transaction_type = Column(String(50), nullable=True)  # income/expense/transfer
    
    # Additional context data stored as JSON
    context_data = Column(JSON, default=dict)  # Time patterns, seasonal data, etc.
    
    # Relationships
    user = relationship("User", back_populates="transaction_patterns")
    payee = relationship("Payee")
    category = relationship("Category")


class UserSelectionHistory(Base):
    """Track every user selection for learning purposes"""
    __tablename__ = 'user_selection_history'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey('transactions.id'), nullable=True)
    
    # Selection Details
    field_type = Column(String(50), nullable=False)  # 'payee' or 'category'
    selected_value_id = Column(UUID(as_uuid=True), nullable=True)  # ID of selected item
    selected_value_name = Column(String(255), nullable=False)  # Name for new items
    
    # Context at time of selection
    transaction_description = Column(Text, nullable=True)
    transaction_amount = Column(Float, nullable=True)
    account_type = Column(String(50), nullable=True)
    
    # Learning metadata
    was_suggested = Column(Boolean, default=False)  # Was this value suggested by AI?
    suggestion_confidence = Column(Float, nullable=True)  # Confidence of the suggestion
    selection_method = Column(String(50), default='manual')  # 'inline_edit', 'form_edit', 'bulk_edit'
    
    # Timing
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")
    transaction = relationship("Transaction")


class UserCorrectionPattern(Base):
    """Learn from user corrections and rejections"""
    __tablename__ = 'user_correction_patterns'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    
    # What was suggested vs what user chose
    original_suggestion_type = Column(String(50), nullable=False)  # 'payee' or 'category'
    original_suggestion_id = Column(UUID(as_uuid=True), nullable=True)
    original_suggestion_name = Column(String(255), nullable=False)
    
    user_correction_id = Column(UUID(as_uuid=True), nullable=True)
    user_correction_name = Column(String(255), nullable=False)
    
    # Context of the correction
    transaction_description = Column(Text, nullable=True)
    transaction_amount = Column(Float, nullable=True)
    suggestion_confidence = Column(Float, nullable=True)
    
    # Learning metrics
    correction_frequency = Column(Integer, default=1)  # How often this correction happens
    context_data = Column(JSON, default=dict)  # Additional context
    
    # Timing
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User")


class LearningStatistics(Base):
    """Track overall learning system performance for each user"""
    __tablename__ = 'learning_statistics'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False, unique=True)
    
    # Overall metrics
    total_suggestions_made = Column(Integer, default=0)
    total_suggestions_accepted = Column(Integer, default=0)
    total_patterns_learned = Column(Integer, default=0)
    
    # Performance metrics
    average_confidence = Column(Float, default=0.0)
    success_rate = Column(Float, default=0.0)  # % of accepted suggestions
    
    # Last update
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User")