"""Reusable shadow-compare helper for the Postgres -> Mongo read-path cutover.

Each stage that converts a router to read from Mongo should, before flipping
READ_SOURCE for that router, run both the Postgres and Mongo code paths for
identical inputs and diff the results with `diff_payloads` below. Normalization
follows the same approach proven in reconcile_pg_mongo.py: Postgres Decimal and
Mongo float stringify differently for an equal value (Decimal('200.00') vs
200.0), so both sides are rounded to a fixed precision before comparing.

Usage sketch (per-router smoke script, added alongside that stage's router
conversion - not meaningful until a router has a Mongo-reading code path):

    from scripts.shadow_compare import diff_payloads

    pg_result = old_postgres_path(...)       # e.g. a list of dicts
    mongo_result = await new_mongo_path(...)  # same shape
    diffs = diff_payloads(pg_result, mongo_result, list_key="id")
    if diffs:
        for d in diffs:
            print(d)
        sys.exit(1)
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, List, Optional

_FLOAT_PRECISION = 2


def _normalize(value: Any) -> Any:
    """Make Postgres/Mongo values comparable: Decimal and float both become
    fixed-precision strings, dates/datetimes become ISO strings, everything
    else passes through unchanged."""
    if isinstance(value, bool):
        return value
    if isinstance(value, (Decimal, float)):
        return f"{float(value):.{_FLOAT_PRECISION}f}"
    if isinstance(value, datetime):
        # Postgres returns tz-aware local datetimes (e.g. +05:30), Mongo stores
        # naive UTC - same instant, different representation. Normalize both to
        # UTC (treating naive values as already UTC, which is what pymongo/motor
        # store) before comparing. BSON datetimes are also millisecond-precision
        # only (truncated, not rounded), so truncate Postgres' microseconds to
        # match instead of flagging the lost digits as drift.
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
        dt = dt.replace(microsecond=(dt.microsecond // 1000) * 1000)
        return dt.isoformat()
    if isinstance(value, dict):
        return {k: _normalize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_normalize(v) for v in value]
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _sort_list(items: List[Any], key: Optional[str]) -> List[Any]:
    if not key:
        return items

    def sort_key(item):
        if isinstance(item, dict):
            return str(item.get(key, ""))
        return str(getattr(item, key, ""))

    return sorted(items, key=sort_key)


def diff_payloads(pg_result: Any, mongo_result: Any, list_key: str = "id", path: str = "") -> List[str]:
    """Recursively diff two normalized payloads.

    Lists are sorted by `list_key` before element-wise comparison, since
    Postgres and Mongo query results aren't guaranteed to return rows in the
    same order unless the query explicitly sorts. Returns a list of
    human-readable mismatch descriptions; an empty list means the payloads
    match.
    """
    pg_norm = _normalize(pg_result)
    mongo_norm = _normalize(mongo_result)

    if isinstance(pg_norm, list) and isinstance(mongo_norm, list):
        if len(pg_norm) != len(mongo_norm):
            return [f"{path or '<root>'}: length mismatch postgres={len(pg_norm)} mongo={len(mongo_norm)}"]
        pg_sorted = _sort_list(pg_norm, list_key)
        mongo_sorted = _sort_list(mongo_norm, list_key)
        diffs = []
        for i, (p, m) in enumerate(zip(pg_sorted, mongo_sorted)):
            diffs.extend(diff_payloads(p, m, list_key, path=f"{path}[{i}]"))
        return diffs

    if isinstance(pg_norm, dict) and isinstance(mongo_norm, dict):
        diffs = []
        for k in sorted(set(pg_norm) | set(mongo_norm)):
            if k not in pg_norm:
                diffs.append(f"{path}.{k}: missing in postgres result")
            elif k not in mongo_norm:
                diffs.append(f"{path}.{k}: missing in mongo result")
            else:
                diffs.extend(diff_payloads(pg_norm[k], mongo_norm[k], list_key, path=f"{path}.{k}"))
        return diffs

    if pg_norm != mongo_norm:
        return [f"{path or '<root>'}: postgres={pg_norm!r} mongo={mongo_norm!r}"]
    return []
