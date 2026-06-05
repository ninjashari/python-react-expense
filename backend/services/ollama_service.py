"""
Ollama-based LLM suggestion service.
Uses full transaction history + known payees/categories as prompt context.
Returns None gracefully when Ollama is unavailable.
"""
import json
import os
import re
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_TIMEOUT  = int(os.getenv("OLLAMA_TIMEOUT", "30"))

_MAX_HISTORY_ROWS = 200  # keep prompt short → faster inference


def _build_prompt(
    description: str,
    amount: Optional[float],
    account_type: Optional[str],
    known_payees: list,
    known_categories: list,
    history: list,
) -> str:
    # Deduplicate history by (payee_name, category_name) groups if too large
    if len(history) > _MAX_HISTORY_ROWS:
        seen = {}
        for row in history:
            key = (row.get("payee_name", ""), row.get("category_name", ""))
            if key not in seen:
                seen[key] = row
        history = list(seen.values())[:_MAX_HISTORY_ROWS]

    payee_list = "\n".join(
        f"  - id={p['id']} name={p['name']}" for p in known_payees
    )
    cat_list = "\n".join(
        f"  - id={c['id']} name={c['name']}" for c in known_categories
    )
    examples = "\n".join(
        f"  \"{row['description']}\" -> payee={row['payee_name']} | category={row['category_name']}"
        for row in history
        if row.get("description") and row.get("payee_name") and row.get("category_name")
    )

    tx_line = f"description={json.dumps(description)}"
    if amount is not None:
        tx_line += f", amount={amount}"
    if account_type:
        tx_line += f", account_type={account_type}"

    return f"""You are a financial transaction classifier. Respond ONLY with a single JSON object — no explanation, no markdown.

KNOWN PAYEES:
{payee_list or '  (none)'}

KNOWN CATEGORIES:
{cat_list or '  (none)'}

HISTORICAL TRANSACTIONS (description -> payee | category):
{examples or '  (none)'}

TASK: Classify this new transaction: {tx_line}

Pick payee_id and category_id from the KNOWN lists above. Use null if no good match.
Confidence should be between 0.0 and 1.0.

Return exactly this JSON:
{{"payee_id": "<id or null>", "payee_name": "<name or null>", "payee_confidence": 0.0, "category_id": "<id or null>", "category_name": "<name or null>", "category_confidence": 0.0}}"""


def _validate_llm_result(result: dict, known_payees: list, known_categories: list) -> dict:
    """
    Cross-check LLM-returned IDs against the known lists.
    If the ID is invalid/hallucinated, try a case-insensitive name match.
    If still no match, null out that field so it is never forwarded to the frontend.
    """
    payee_by_id   = {p["id"]: p for p in known_payees}
    payee_by_name = {p["name"].lower(): p for p in known_payees}
    cat_by_id     = {c["id"]: c for c in known_categories}
    cat_by_name   = {c["name"].lower(): c for c in known_categories}

    # ── Payee ──────────────────────────────────────────────────────────────
    pid = result.get("payee_id")
    if pid and pid not in payee_by_id:
        pname = (result.get("payee_name") or "").lower().strip()
        matched = payee_by_name.get(pname)
        if matched:
            logger.debug("LLM payee_id %r invalid; matched by name %r → %r", pid, pname, matched["id"])
            result["payee_id"]   = matched["id"]
            result["payee_name"] = matched["name"]
        else:
            logger.debug("LLM payee_id %r invalid and name %r unmatched — nulled", pid, pname)
            result["payee_id"]   = None
            result["payee_name"] = None

    # ── Category ───────────────────────────────────────────────────────────
    cid = result.get("category_id")
    if cid and cid not in cat_by_id:
        cname = (result.get("category_name") or "").lower().strip()
        matched = cat_by_name.get(cname)
        if matched:
            logger.debug("LLM category_id %r invalid; matched by name %r → %r", cid, cname, matched["id"])
            result["category_id"]   = matched["id"]
            result["category_name"] = matched["name"]
        else:
            logger.debug("LLM category_id %r invalid and name %r unmatched — nulled", cid, cname)
            result["category_id"]   = None
            result["category_name"] = None

    return result


def _parse_response(text: str) -> Optional[dict]:
    """Extract JSON from LLM response text."""
    try:
        # Try direct parse first
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass
    # Extract first {...} block
    match = re.search(r'\{[^{}]+\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return None


async def get_llm_suggestions(
    description: str,
    amount: Optional[float],
    account_type: Optional[str],
    known_payees: list,
    known_categories: list,
    history: list,
    timeout: Optional[int] = None,
) -> Optional[dict]:
    """
    Call Ollama and return parsed suggestion dict, or None on any failure.

    Return shape:
    {
        "payee_id": str | None,
        "payee_name": str | None,
        "payee_confidence": float,
        "category_id": str | None,
        "category_name": str | None,
        "category_confidence": float,
    }
    """
    prompt = _build_prompt(
        description, amount, account_type,
        known_payees, known_categories, history,
    )

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.1, "num_predict": 80},
    }

    effective_timeout = timeout if timeout is not None else OLLAMA_TIMEOUT
    try:
        async with httpx.AsyncClient(timeout=effective_timeout) as client:
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            raw_text = data.get("response", "")
    except httpx.ConnectError:
        logger.debug("Ollama not reachable — using ML fallback")
        return None
    except httpx.ReadTimeout:
        logger.debug(
            "Ollama timed out after %ss for description=%r — using ML fallback",
            effective_timeout, description[:60]
        )
        return None
    except httpx.HTTPStatusError as exc:
        logger.warning("Ollama HTTP error %s: %s", exc.response.status_code, exc.response.text[:200])
        return None
    except Exception as exc:
        logger.warning("Ollama request failed (%s): %s", type(exc).__name__, exc)
        return None

    parsed = _parse_response(raw_text)
    if not parsed:
        logger.warning("Ollama returned unparseable response: %s", raw_text[:200])
        return None

    parsed = _validate_llm_result(parsed, known_payees, known_categories)

    # If validation nulled out both fields, treat as no useful result
    if not parsed.get("payee_id") and not parsed.get("category_id"):
        logger.debug("LLM result had no valid IDs after validation — skipping")
        return None

    return parsed
