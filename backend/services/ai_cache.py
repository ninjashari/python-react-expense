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
# Stores the stats dict returned by train_from_historical_data() for each user
_last_training_stats: Dict[str, dict] = {}
# Selection counter per user — triggers auto-retrain every AUTO_RETRAIN_EVERY selections
_selection_counter: Dict[str, int] = {}
AUTO_RETRAIN_EVERY = 20
# One-shot flags: a cache-miss training just ran inside an import request, so the
# import's own post-commit retrain would be redundant — skip it once.
_skip_next_retrain: set = set()


def get_cached_trainer(db, user_id) -> "TransactionAITrainer":
    """
    Return a trained TransactionAITrainer for the given user.
    Trains and caches on first call; subsequent calls return the cached instance.
    """
    from services.ai_trainer import TransactionAITrainer
    from services.training_logger import start_training, make_log_fn, end_training
    key = str(user_id)
    if key not in _trainer_cache:
        # Cache miss: train synchronously, streaming logs so the UI can poll them
        start_training(user_id)
        try:
            trainer = TransactionAITrainer(db, user_id, log_fn=make_log_fn(user_id))
            stats = trainer.train_from_historical_data()
        finally:
            end_training(user_id)
        set_last_training_stats(user_id, stats)
        _trainer_cache[key] = trainer
        _skip_next_retrain.add(key)
    return _trainer_cache[key]


def set_cached_trainer(user_id, trainer: "TransactionAITrainer") -> None:
    """Store an already-trained trainer in the cache (e.g. after manual retraining)."""
    _trainer_cache[str(user_id)] = trainer


def set_last_training_stats(user_id, stats: dict) -> None:
    """Store the stats dict returned by train_from_historical_data() for later inspection."""
    _last_training_stats[str(user_id)] = stats


def get_last_training_stats(user_id) -> dict:
    """Return the most recent training stats for the user, or {} if never trained."""
    return _last_training_stats.get(str(user_id), {})


def invalidate_trainer(user_id) -> None:
    """Remove a user's cached trainer so the next request re-trains from scratch."""
    _trainer_cache.pop(str(user_id), None)


def record_selection_and_maybe_retrain(user_id) -> None:
    """
    Increment the selection counter for user_id.
    Triggers background retraining every AUTO_RETRAIN_EVERY selections.
    Call this from the record-selection endpoint (fire-and-forget via BackgroundTasks).
    """
    key = str(user_id)
    try:
        from services.suggestion_context import invalidate_context
        invalidate_context(user_id)
    except Exception:
        pass
    _selection_counter[key] = _selection_counter.get(key, 0) + 1
    if _selection_counter[key] % AUTO_RETRAIN_EVERY == 0:
        retrain_in_background(user_id)


def retrain_in_background(user_id) -> None:
    """
    Retrain a user's model and hot-swap it into the cache.
    Logs are written in real time to training_logger so the UI can poll them.
    Designed to be called via FastAPI BackgroundTasks after an import commit.
    """
    from database import SessionLocal
    from services.ai_trainer import TransactionAITrainer
    from services.training_logger import start_training, make_log_fn, end_training

    key = str(user_id)
    if key in _skip_next_retrain:
        _skip_next_retrain.discard(key)
        print(f"[AI] Skipping post-import retrain for user {key} — model was just trained during the import")
        return

    db = SessionLocal()
    try:
        start_training(user_id)
        log_fn = make_log_fn(user_id)
        trainer = TransactionAITrainer(db, user_id, log_fn=log_fn)
        stats = trainer.train_from_historical_data()
        set_last_training_stats(user_id, stats)
        set_cached_trainer(user_id, trainer)
    except Exception as e:
        print(f"[AI] Background retraining failed for user {user_id}: {e}")
    finally:
        end_training(user_id)
        db.close()
