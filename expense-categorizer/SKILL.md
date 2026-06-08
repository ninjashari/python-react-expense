---
name: expense-categorizer
description: >
  Intelligently assigns categories and payees to expense manager transactions,
  one at a time, with user approval before each change. Use this skill whenever
  the user says things like: "do my categories", "categorize my [bank] transactions",
  "assign payees for [account]", "go through my HDFC/ICICI/Axis/SBI transactions",
  "review transactions from [date]", "clean up [bank] expenses", "help me categorize",
  "do the expense review for [bank]". Works account by account, supports overwriting
  existing category/payee assignments, and learns from every approval.
---

# Expense Categorizer Skill

One-by-one transaction review: Claude proposes category + payee, user approves,
changes are applied. Every approval trains future suggestions.

## Setup

**Script:** `C:\Dev\python-react-expense\claude_categorizer.py`  
**Run via Desktop Commander** using `cmd /c python ...`

---

## Step 1 — Collect inputs

Ask (only for what's missing):
1. **Bank / account name** — partial match works ("HDFC", "ICICI Sapphiro", "Axis")
2. **Start date** — e.g. "2025-01-01" (optional)
3. **Overwrite mode** — "Should I also review transactions that already have a category/payee?" Default: no.

If the user already said "do HDFC from January" — extract directly, don't re-ask.

---

## Step 2 — Fetch suggestions

```
cmd /c python C:\Dev\python-react-expense\claude_categorizer.py suggest
  --account "<name>" [--start-date YYYY-MM-DD] [--overwrite] [--limit 50]
```

Parse the JSON array. Each item contains:
- `id`, `description`, `amount`, `type`, `date`, `account`
- `current_category`, `current_payee` — currently set values (null = unset)
- `needs_category`, `needs_payee` — booleans
- `cat_suggestions[]` — `{id, name, score, reason}` ranked by score
- `payee_suggestions[]` — same format

If array is empty → "Nothing to categorize for [account]."

---

## Step 3 — Review one transaction at a time

Use **AskUserQuestion** — combine category + payee into **one call (2 questions)** per transaction.

**Show per transaction:**
- Index (e.g. "3/15"), account, date, amount (income/expense), description (truncate UPI to 60 chars)
- Current values if overwrite mode is on ("Currently: Food / Swiggy")
- Top suggestions with score + reason

**Option labels:**
- `✅ [Name] (suggested)` — top pick, add "High confidence" if score ≥ 0.75
- 2nd/3rd alternatives if score > 0.30
- `⏭ Skip` — leave unchanged

**Score labels to show in option descriptions:**
- score ≥ 0.75 → "High confidence"
- score 0.40–0.74 → show score as percentage
- score < 0.40 → "Low confidence — please verify"

**When user types a custom name (Other):**
- Category: look it up in the DB. If not found, tell them to create it in the UI first.
- Payee: look it up in the DB. If not found, create it automatically (see New Payee Creation below).

---

## Step 4 — Apply changes

```
cmd /c python C:\Dev\python-react-expense\claude_categorizer.py apply <id>
  [--category <uuid>] [--payee <uuid>]
```

Skip silently when user picks Skip. Don't recap each applied change — keep momentum.

---

## New Payee Creation

When a custom payee name doesn't exist in the DB, create it with this tmp script:

```python
import psycopg2, uuid, re
c = psycopg2.connect('postgresql://expense_user:nezuko@localhost:5432/expenses')
cur = c.cursor()
cur.execute("SELECT user_id FROM transactions LIMIT 1")
user_id = cur.fetchone()[0]
name = "PAYEE_NAME_HERE"
slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
pid = str(uuid.uuid4())
cur.execute("INSERT INTO payees (id,user_id,name,slug,created_at,updated_at) VALUES (%s,%s,%s,%s,NOW(),NOW())", (pid, user_id, name, slug))
c.commit()
print(pid)
```

Write to `C:\Dev\python-react-expense\claude_tmp.py`, run, capture the UUID, use in apply.

---

## Step 5 — Summary

After all transactions:
- Report: "Applied X changes, skipped Y. All transactions categorized. ✅"
- Offer to run another account or adjust the date range.

---

## Key reminders

- Combine category + payee into one AskUserQuestion (2 questions) per transaction
- In overwrite mode, always show current value so user knows what changes FROM → TO
- Every `apply` call records to `user_selection_history` — the system gets smarter with each run
