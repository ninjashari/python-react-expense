from datetime import datetime
from typing import Any, Dict, List, Optional

from beanie import Document
from pymongo import IndexModel


class UserTransactionPatternDocument(Document):
    id: str
    user_id: str
    description_keywords: List[str] = []
    payee_id: Optional[str] = None
    category_id: Optional[str] = None
    confidence_score: float = 0.1
    usage_frequency: int = 1
    success_rate: float = 1.0
    last_used: Optional[datetime] = None
    created_at: Optional[datetime] = None
    amount_min: Optional[float] = None
    amount_max: Optional[float] = None
    account_types: Optional[List[str]] = None
    transaction_type: Optional[str] = None
    context_data: Dict[str, Any] = {}

    class Settings:
        name = "user_transaction_patterns"
        indexes = [
            IndexModel([("user_id", 1), ("description_keywords", 1)]),
        ]


class UserSelectionHistoryDocument(Document):
    id: str
    user_id: str
    transaction_id: Optional[str] = None
    field_type: str
    selected_value_id: Optional[str] = None
    selected_value_name: str
    transaction_description: Optional[str] = None
    transaction_amount: Optional[float] = None
    account_type: Optional[str] = None
    was_suggested: bool = False
    suggestion_confidence: Optional[float] = None
    selection_method: str = "manual"
    created_at: Optional[datetime] = None

    class Settings:
        name = "user_selection_history"
        indexes = [
            IndexModel([("user_id", 1)]),
            IndexModel([("transaction_id", 1)]),
        ]


class UserCorrectionPatternDocument(Document):
    id: str
    user_id: str
    original_suggestion_type: str
    original_suggestion_id: Optional[str] = None
    original_suggestion_name: str
    user_correction_id: Optional[str] = None
    user_correction_name: str
    transaction_description: Optional[str] = None
    transaction_amount: Optional[float] = None
    suggestion_confidence: Optional[float] = None
    correction_frequency: int = 1
    context_data: Dict[str, Any] = {}
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None

    class Settings:
        name = "user_correction_patterns"
        indexes = [
            IndexModel([("user_id", 1)]),
        ]


class LearningStatisticsDocument(Document):
    id: str
    user_id: str
    total_suggestions_made: int = 0
    total_suggestions_accepted: int = 0
    total_patterns_learned: int = 0
    average_confidence: float = 0.0
    success_rate: float = 0.0
    last_updated: Optional[datetime] = None

    class Settings:
        name = "learning_statistics"
        indexes = [
            IndexModel([("user_id", 1)], unique=True),
        ]
