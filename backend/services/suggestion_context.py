"""
Per-user LLM suggestion context cache.

Building the LLM prompt context requires loading the user's payees, categories,
and up to 2 years of labelled transactions. That is far too expensive to do on
every keystroke, so we cache it per user with a short TTL and explicit
invalidation on data changes.
"""
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, Optional

# user_id (str) -> {"built_at": float, "payees": [...], "categories": [...], "history": [...]}
_context_cache: Dict[str, dict] = {}
_lock = threading.Lock()

CONTEXT_TTL_SECONDS = 300  # 5 minutes
HISTORY_DAYS = 730         # 2 years
HISTORY_MAX_ROWS = 800     # hard cap on examples sent to the LLM


def _build_context(db, user_id) -> dict:
    """Heavy query — load payees, categories and 2-year labelled history."""
    from models.transactions import Transaction
    from models.payees import Payee
    from models.categories import Category

    payees = [
        {"id": str(p.id), "name": p.name}
        for p in db.query(Payee).filter(Payee.user_id == user_id).all()
    ]
    categories = [
        {"id": str(c.id), "name": c.name, "color": c.color}
        for c in db.query(Category).filter(Category.user_id == user_id).all()
    ]
    payee_map = {p["id"]: p["name"] for p in payees}
    cat_map = {c["id"]: c["name"] for c in categories}

    cutoff = datetime.utcnow() - timedelta(days=HISTORY_DAYS)
    txns = (
        db.query(Transaction)
        .filter(
            Transaction.user_id == user_id,
            Transaction.payee_id.isnot(None),
            Transaction.category_id.isnot(None),
            Transaction.description.isnot(None),
            Transaction.date >= cutoff,
        )
        .order_by(Transaction.date.desc())
        .limit(HISTORY_MAX_ROWS)
        .all()
    )

    history = []
    for tx in txns:
        pname = payee_map.get(str(tx.payee_id))
        cname = cat_map.get(str(tx.category_id))
        if pname and cname:
            history.append({
                "description": tx.description,
                "payee_name": pname,
                "category_name": cname,
            })

    return {
        "built_at": time.time(),
        "payees": payees,
        "categories": categories,
        "history": history,
    }


def get_context(db, user_id) -> dict:
    """Return cached context, rebuilding on miss or when stale."""
    key = str(user_id)
    now = time.time()
    cached = _context_cache.get(key)
    if cached and (now - cached["built_at"]) < CONTEXT_TTL_SECONDS:
        return cached

    with _lock:
        # Re-check after acquiring the lock (another thread may have built it)
        cached = _context_cache.get(key)
        if cached and (time.time() - cached["built_at"]) < CONTEXT_TTL_SECONDS:
            return cached
        ctx = _build_context(db, user_id)
        _context_cache[key] = ctx
        return ctx


def invalidate_context(user_id) -> None:
    """Drop a user's cached context so the next request rebuilds it."""
    _context_cache.pop(str(user_id), None)
