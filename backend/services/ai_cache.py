"""
AI Trainer cache — lazy per-user model cache.
First prediction for a user trains and caches the model on demand.
After each import, background retraining silently hot-swaps the model.
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


def retrain_in_background(user_id) -> None:
    """
    Retrain a user's model and hot-swap it into the cache.
    The old cached model remains live during training — predictions stay fast.
    Designed to be called via FastAPI BackgroundTasks after an import commit.
    """
    from database import SessionLocal
    from services.ai_trainer import TransactionAITrainer
    db = SessionLocal()
    try:
        print(f"[AI] Background retraining for user {user_id}...")
        trainer = TransactionAITrainer(db, user_id)
        trainer.train_from_historical_data()
        set_cached_trainer(user_id, trainer)
        print(f"[AI] Background retraining complete for user {user_id}")
    except Exception as e:
        print(f"[AI] Background retraining failed for user {user_id}: {e}")
    finally:
        db.close()
