from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


class UserSelectionRequest(BaseModel):
    """Request schema for recording user selections"""
    transaction_id: str
    field_type: str  # 'payee' or 'category'
    selected_value_id: Optional[str] = None
    selected_value_name: str
    transaction_description: Optional[str] = None
    transaction_amount: Optional[float] = None
    account_type: Optional[str] = None
    was_suggested: bool = False
    suggestion_confidence: Optional[float] = None
    selection_method: str = 'manual'


class SmartSuggestionRequest(BaseModel):
    """Request schema for getting smart suggestions"""
    description: str
    amount: Optional[float] = None
    account_id: Optional[str] = None
    account_type: Optional[str] = None


class SuggestionItem(BaseModel):
    """Individual suggestion item"""
    id: str
    name: str
    type: str  # 'ai_suggestion', 'historical', 'existing', 'create_new'
    confidence: float
    reason: str
    usage_count: Optional[int] = None
    color: Optional[str] = None  # For categories


class SmartSuggestionResponse(BaseModel):
    """Response schema for smart suggestions"""
    payee_suggestions: List[SuggestionItem]
    category_suggestions: List[SuggestionItem]
    confidence_explanation: Optional[str] = None


class UserTransactionPatternResponse(BaseModel):
    """Response schema for user transaction patterns"""
    id: str
    description_keywords: List[str]
    payee_name: Optional[str] = None
    category_name: Optional[str] = None
    confidence_score: float
    usage_frequency: int
    success_rate: float
    last_used: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True


class LearningStatisticsResponse(BaseModel):
    """Response schema for learning statistics"""
    total_suggestions_made: int
    total_suggestions_accepted: int
    total_patterns_learned: int
    average_confidence: float
    success_rate: float
    last_updated: datetime
    
    class Config:
        from_attributes = True


class LearningFeedbackRequest(BaseModel):
    """Request schema for learning feedback"""
    suggestion_id: str
    was_accepted: bool
    user_selected_id: Optional[str] = None
    user_selected_name: Optional[str] = None
    transaction_context: Dict[str, Any]