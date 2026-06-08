"""
Claude's intelligent category/payee assistant for expense manager.
Usage:
  python claude_categorizer.py suggest [--account "Name"] [--start-date YYYY-MM-DD]
                                        [--overwrite] [--limit 30]
  python claude_categorizer.py apply <transaction_id> [--category <id>] [--payee <id>]
  python claude_categorizer.py accounts
  python claude_categorizer.py history <transaction_id>
"""

import sys, json, re, argparse, uuid
import psycopg2
from difflib import SequenceMatcher

DB_URL = "postgresql://postgres:password@localhost:5432/expenses_db"

def conn():
    return psycopg2.connect(DB_URL)

# ── UPI parsing ──────────────────────────────────────────────────────────────

def parse_upi(desc):
    if not desc or not desc.upper().startswith("UPI"):
        return None, None
    parts = [p.strip() for p in desc.split("-")]
    merchant = parts[1].title() if len(parts) > 1 else None
    hint = parts[-1].upper() if len(parts) > 1 else None
    return merchant, hint

def similarity(a, b):
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

# ── Data loaders ─────────────────────────────────────────────────────────────

def load_categories(cur):
    cur.execute("SELECT id, name FROM categories ORDER BY name")
    return {str(r[0]): r[1] for r in cur.fetchall()}

def load_payees(cur):
    cur.execute("SELECT id, name FROM payees ORDER BY name")
    return {str(r[0]): r[1] for r in cur.fetchall()}

def load_accounts(cur):
    cur.execute("SELECT id, name, type FROM accounts ORDER BY name")
    return cur.fetchall()

def load_selection_history(cur):
    cur.execute("""
        SELECT transaction_description, field_type,
               selected_value_id::text, selected_value_name, COUNT(*) as freq
        FROM user_selection_history
        WHERE transaction_description IS NOT NULL
        GROUP BY transaction_description, field_type, selected_value_id, selected_value_name
        ORDER BY freq DESC
    """)
    return cur.fetchall()

def load_patterns(cur):
    cur.execute("""
        SELECT description_keywords, payee_id::text, category_id::text,
               confidence_score, usage_frequency, success_rate
        FROM user_transaction_patterns
        ORDER BY confidence_score DESC, usage_frequency DESC
    """)
    return cur.fetchall()

def load_categorized_similar(cur):
    cur.execute("""
        SELECT t.description, c.id::text, c.name, p.id::text, p.name, COUNT(*) as freq
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        LEFT JOIN payees p ON t.payee_id = p.id
        WHERE t.category_id IS NOT NULL AND t.description IS NOT NULL
        GROUP BY t.description, c.id, c.name, p.id, p.name
        ORDER BY freq DESC LIMIT 2000
    """)
    return cur.fetchall()

# ── Scoring engine ────────────────────────────────────────────────────────────

HINT_MAP = {
    "CAB":      ["Travel"], "TAXI": ["Travel"], "AUTO": ["Travel"],
    "FOOD":     ["Food", "Food Order", "Dining Out"],
    "MOMOS":    ["Food", "Dining Out"], "RABDI": ["Sweets", "Dining Out"],
    "GROCERY":  ["Groceries"], "MILK": ["Groceries"],
    "FUEL":     ["Petrol"], "PETROL": ["Petrol"],
    "RENT":     ["Rent"], "SALARY": ["Salary"], "MEDICINE": ["Medicine"],
    "HOTEL":    ["Travel Hotel"], "TOLL": ["Road Toll", "Fastag"],
    "WATER":    ["Homeneeds"], "ELECTRIC": ["Electricity Bill"],
    "INSURANCE": ["LIC"], "GAS": ["Cooking Gas Bill"],
}

def score_suggestions(desc, amount, account_type, tx_type,
                      history, patterns, similar_txns, categories, payees):
    cat_scores, payee_scores = {}, {}

    def add_cat(cid, cname, score, reason):
        if cid not in cat_scores or cat_scores[cid][1] < score:
            cat_scores[cid] = (cname, score, reason)

    def add_payee(pid, pname, score, reason):
        if pid not in payee_scores or payee_scores[pid][1] < score:
            payee_scores[pid] = (pname, score, reason)

    upi_merchant, upi_hint = parse_upi(desc)

    # 1. Exact match in selection history
    for hist_desc, field, vid, vname, freq in history:
        if hist_desc == desc:
            sc = min(0.95, 0.70 + freq * 0.05)
            if field == "category" and vid: add_cat(vid, vname, sc, f"exact history ({freq}x)")
            elif field == "payee" and vid:  add_payee(vid, vname, sc, f"exact history ({freq}x)")

    # 2. High-similarity match in selection history
    for hist_desc, field, vid, vname, freq in history:
        if not hist_desc or hist_desc == desc: continue
        sim = similarity(desc, hist_desc)
        if sim >= 0.60:
            sc = sim * 0.65 * min(1.0, 0.7 + freq * 0.1)
            if field == "category" and vid: add_cat(vid, vname, sc, f"similar desc ({sim:.0%})")
            elif field == "payee" and vid:  add_payee(vid, vname, sc, f"similar desc ({sim:.0%})")

    # 3. Already-categorized similar transactions
    for sim_desc, cid, cname, pid, pname, freq in similar_txns:
        if sim_desc == desc:
            sc = min(0.90, 0.75 + freq * 0.02)
            if cid: add_cat(cid, cname, sc, f"same desc in history ({freq}x)")
            if pid: add_payee(pid, pname, sc, f"same desc in history ({freq}x)")
        elif sim_desc:
            sim = similarity(desc, sim_desc)
            if sim >= 0.65:
                sc = sim * 0.60
                if cid: add_cat(cid, cname, sc, f"similar tx ({sim:.0%}, {freq}x)")
                if pid: add_payee(pid, pname, sc, f"similar tx ({sim:.0%}, {freq}x)")

    # 4. Keyword patterns
    for keywords, pid, cid, conf, freq, success in patterns:
        if not keywords: continue
        kw_hits = sum(1 for kw in keywords if kw.lower() in desc.lower())
        if kw_hits > 0:
            sc = (kw_hits / len(keywords)) * conf * success
            if cid and cid in categories: add_cat(cid, categories[cid], sc, f"keyword pattern ({kw_hits}/{len(keywords)} kw)")
            if pid and pid in payees:     add_payee(pid, payees[pid], sc, f"keyword pattern ({kw_hits}/{len(keywords)} kw)")

    # 5. UPI hint rules
    if upi_hint:
        for hint_kw, cat_names in HINT_MAP.items():
            if hint_kw in upi_hint:
                for cname in cat_names:
                    for cid, cn in categories.items():
                        if cn.lower() == cname.lower():
                            add_cat(cid, cn, 0.55, f"UPI hint '{hint_kw}'")

    # 6. UPI merchant → payee match
    if upi_merchant:
        for pid, pname in payees.items():
            sim = similarity(upi_merchant, pname)
            if sim >= 0.55:
                add_payee(pid, pname, sim * 0.65, f"UPI merchant match ({sim:.0%})")

    return cat_scores, payee_scores

def top_n(scores, n=5):
    ranked = [(sid, name, score, reason) for sid, (name, score, reason) in scores.items()]
    return sorted(ranked, key=lambda x: -x[2])[:n]

# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_accounts():
    with conn() as c:
        cur = c.cursor()
        for row in load_accounts(cur):
            print(json.dumps({"id": str(row[0]), "name": row[1], "type": row[2]}))

def cmd_suggest(account_filter=None, start_date=None, overwrite=False, limit=30):
    with conn() as c:
        cur = c.cursor()
        categories   = load_categories(cur)
        payees       = load_payees(cur)
        history      = load_selection_history(cur)
        patterns     = load_patterns(cur)
        similar_txns = load_categorized_similar(cur)

        sql = """
            SELECT t.id, t.description, t.amount::float, t.type, t.date::text,
                   a.name, a.type,
                   c.id::text, c.name, p.id::text, p.name
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN payees p     ON t.payee_id = p.id
            WHERE 1=1
        """
        params = []

        # Without --overwrite, only show transactions missing cat OR payee
        if not overwrite:
            sql += " AND (t.category_id IS NULL OR t.payee_id IS NULL)"

        if account_filter:
            sql += " AND LOWER(a.name) LIKE LOWER(%s)"
            params.append(f"%{account_filter}%")

        if start_date:
            sql += " AND t.date >= %s"
            params.append(start_date)

        sql += " ORDER BY t.date DESC LIMIT %s"
        params.append(limit)
        cur.execute(sql, params)
        txns = cur.fetchall()

    results = []
    for row in txns:
        tid, desc, amount, tx_type, date, acct_name, acct_type, \
            cur_cat_id, cur_cat_name, cur_pay_id, cur_pay_name = row

        cat_scores, payee_scores = score_suggestions(
            desc, amount, acct_type, tx_type,
            history, patterns, similar_txns, categories, payees
        )

        results.append({
            "id":               str(tid),
            "description":      desc,
            "amount":           amount,
            "type":             tx_type,
            "date":             date,
            "account":          acct_name,
            "current_category": cur_cat_name,
            "current_payee":    cur_pay_name,
            "needs_category":   cur_cat_id is None,
            "needs_payee":      cur_pay_id is None,
            "cat_suggestions":  [
                {"id": i, "name": n, "score": round(s, 3), "reason": r}
                for i, n, s, r in top_n(cat_scores)
            ],
            "payee_suggestions": [
                {"id": i, "name": n, "score": round(s, 3), "reason": r}
                for i, n, s, r in top_n(payee_scores)
            ],
        })

    def best_score(r):
        c = r["cat_suggestions"][0]["score"]  if r["cat_suggestions"]  else 0
        p = r["payee_suggestions"][0]["score"] if r["payee_suggestions"] else 0
        return c + p
    results.sort(key=best_score, reverse=True)
    print(json.dumps(results, default=str, indent=2))

def cmd_apply(transaction_id, category_id=None, payee_id=None):
    with conn() as c:
        cur = c.cursor()
        cur.execute("""
            SELECT t.user_id, t.description, t.amount::float, a.type
            FROM transactions t JOIN accounts a ON t.account_id = a.id
            WHERE t.id = %s
        """, (transaction_id,))
        row = cur.fetchone()
        if not row:
            print(json.dumps({"error": "Transaction not found"})); return
        user_id, desc, amount, acct_type = row

        updates, params = [], []
        if category_id:
            updates.append("category_id = %s"); params.append(category_id)
        if payee_id:
            updates.append("payee_id = %s"); params.append(payee_id)
        if not updates:
            print(json.dumps({"error": "Nothing to apply"})); return

        params.append(transaction_id)
        cur.execute(f"UPDATE transactions SET {', '.join(updates)} WHERE id = %s", params)

        # Record in selection_history so the system learns
        if category_id:
            cur.execute("SELECT name FROM categories WHERE id = %s", (category_id,))
            cat_name = (cur.fetchone() or ["Unknown"])[0]
            cur.execute("""INSERT INTO user_selection_history
                (id,user_id,transaction_id,field_type,selected_value_id,selected_value_name,
                 transaction_description,transaction_amount,account_type,was_suggested,
                 selection_method,created_at)
                VALUES (%s,%s,%s,'category',%s,%s,%s,%s,%s,true,'claude_assistant',NOW())""",
                (str(uuid.uuid4()), str(user_id), transaction_id,
                 category_id, cat_name, desc, amount, acct_type))

        if payee_id:
            cur.execute("SELECT name FROM payees WHERE id = %s", (payee_id,))
            pay_name = (cur.fetchone() or ["Unknown"])[0]
            cur.execute("""INSERT INTO user_selection_history
                (id,user_id,transaction_id,field_type,selected_value_id,selected_value_name,
                 transaction_description,transaction_amount,account_type,was_suggested,
                 selection_method,created_at)
                VALUES (%s,%s,%s,'payee',%s,%s,%s,%s,%s,true,'claude_assistant',NOW())""",
                (str(uuid.uuid4()), str(user_id), transaction_id,
                 payee_id, pay_name, desc, amount, acct_type))

        c.commit()
        print(json.dumps({"status": "ok", "transaction_id": transaction_id,
                          "category_id": category_id, "payee_id": payee_id}))


def cmd_history(transaction_id):
    with conn() as c:
        cur = c.cursor()
        cur.execute("SELECT description FROM transactions WHERE id = %s", (transaction_id,))
        row = cur.fetchone()
        if not row: print(json.dumps({"error": "Not found"})); return
        desc = row[0]
        cur.execute("""
            SELECT field_type, selected_value_name, COUNT(*) as freq
            FROM user_selection_history WHERE transaction_description = %s
            GROUP BY field_type, selected_value_name ORDER BY freq DESC
        """, (desc,))
        print(json.dumps({"description": desc,
            "history": [{"field": r[0], "value": r[1], "count": r[2]} for r in cur.fetchall()]}))


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd")

    p_sug = sub.add_parser("suggest")
    p_sug.add_argument("--account", default=None)
    p_sug.add_argument("--start-date", default=None)
    p_sug.add_argument("--overwrite", action="store_true",
                       help="Include transactions that already have category/payee")
    p_sug.add_argument("--limit", type=int, default=30)

    p_app = sub.add_parser("apply")
    p_app.add_argument("transaction_id")
    p_app.add_argument("--category", default=None)
    p_app.add_argument("--payee", default=None)

    sub.add_parser("accounts")

    p_hist = sub.add_parser("history")
    p_hist.add_argument("transaction_id")

    args = parser.parse_args()
    if args.cmd == "suggest":
        cmd_suggest(args.account, getattr(args, "start_date", None),
                    args.overwrite, args.limit)
    elif args.cmd == "apply":
        cmd_apply(args.transaction_id, args.category, args.payee)
    elif args.cmd == "accounts":
        cmd_accounts()
    elif args.cmd == "history":
        cmd_history(args.transaction_id)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
