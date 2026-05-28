"""
AI Trainer cache — trains each user's model once at startup and keeps it in memory.
Import paths use get_cached_trainer() instead of re-training on every request.
"""
from typing import Dict, TYPE_CHECKING

if TYPE_CHECKING:
    from services.ai_trainer import TransactionAITrainer

# Module-level cache: user_id (str) -> trained TransactionAITrainer instance
_trainer_cache: Dict[str, "TransactionAITrainer"] = {}


def get_cached_trainer(db, user_id) -> "TransactionAITrainer":
    """
    Return a trained TransactionAITrainer for the given user.
    Trains and caches on first call; subsequent calls return the cached instance.
    """
    from services.ai_trainer import TransactionAITrainer
    key = str(user_id)
    if key not in _trainer_cache:
        print(f"Training AI model for user {key}...")
        trainer = TransactionAITrainer(db, user_id)
        trainer.train_from_historical_data()
        _trainer_cache[key] = trainer
        print(f"AI model cached for user {key}")
    return _trainer_cache[key]


def set_cached_trainer(user_id, trainer: "TransactionAITrainer") -> None:
    """Store an already-trained trainer in the cache (e.g. after manual retraining)."""
    _trainer_cache[str(user_id)] = trainer


def invalidate_trainer(user_id) -> None:
    """Remove a user's cached trainer so the next request re-trains from scratch."""
    _trainer_cache.pop(str(user_id), None)
