"""Real-time training log store — no stdout redirection, thread-safe."""

import threading
import time
from collections import defaultdict
from datetime import datetime
from typing import Callable, Dict, List

_training_logs: Dict[str, List[Dict]] = defaultdict(list)
_training_active: Dict[str, bool] = {}
_lock = threading.Lock()


def start_training(user_id: str) -> None:
    with _lock:
        _training_logs[str(user_id)] = []
        _training_active[str(user_id)] = True


def log_training(user_id: str, message: str) -> None:
    """Append a log line to the user's training session. Thread-safe."""
    # Also echo to real stdout so server console still shows progress
    print(message, flush=True)
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "level": "AI" if "[AI]" in message else "info",
        "message": message,
    }
    with _lock:
        _training_logs[str(user_id)].append(entry)


def end_training(user_id: str) -> None:
    with _lock:
        _training_active[str(user_id)] = False


def make_log_fn(user_id: str) -> Callable[[str], None]:
    """Return a log function bound to user_id, for passing into the trainer."""
    def _log(message: str) -> None:
        log_training(user_id, message)
    return _log


def get_training_logs(user_id: str) -> List[Dict]:
    with _lock:
        return list(_training_logs.get(str(user_id), []))


def has_active_training(user_id: str) -> bool:
    with _lock:
        return _training_active.get(str(user_id), False)
