from .users import UserDocument
from .accounts import AccountDocument
from .categories import CategoryDocument
from .payees import PayeeDocument
from .transactions import TransactionDocument, AccountRef, CategoryRef, PayeeRef
from .learning import (
    UserTransactionPatternDocument,
    UserSelectionHistoryDocument,
    UserCorrectionPatternDocument,
    LearningStatisticsDocument,
)
from .reward_points import RewardPointRedemptionDocument, RewardPointBonusDocument

ALL_DOCUMENT_MODELS = [
    UserDocument,
    AccountDocument,
    CategoryDocument,
    PayeeDocument,
    TransactionDocument,
    UserTransactionPatternDocument,
    UserSelectionHistoryDocument,
    UserCorrectionPatternDocument,
    LearningStatisticsDocument,
    RewardPointRedemptionDocument,
    RewardPointBonusDocument,
]

__all__ = [
    "UserDocument", "AccountDocument", "CategoryDocument", "PayeeDocument",
    "TransactionDocument", "AccountRef", "CategoryRef", "PayeeRef",
    "UserTransactionPatternDocument", "UserSelectionHistoryDocument",
    "UserCorrectionPatternDocument", "LearningStatisticsDocument",
    "RewardPointRedemptionDocument", "RewardPointBonusDocument",
    "ALL_DOCUMENT_MODELS",
]
