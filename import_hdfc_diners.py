"""
Import HDFC Diners Club Privilege transactions from export xlsx files into the expense DB.

Usage:
    python import_hdfc_diners.py [--dry-run] [--year 2025|2026] [--email user@example.com]

Reads all export files from:
    D:\Documents\Finances\Credit Cards\HDFC Diners Club Privilege\Export Statement\

Handles:
    - Duplicate detection (skips existing date + amount + description matches)
    - Credit card balance updates
    - Reward points
    - Both withdrawal (expense) and deposit (income/payment) rows
"""

import os, sys, argparse, uuid, glob
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

import openpyxl
import psycopg2
import psycopg2.extras
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
psycopg2.extras.register_uuid()

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env"))
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL is not set; configure it in backend/.env")
EXPORT_BASE = r"D:\Documents\Finances\Credit Cards\HDFC Diners Club Privilege\Export Statement"  # noqa


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(DB_URL)


def find_account(cur, email: str):
    """Find HDFC Diners Club account for the given user."""
    cur.execute("""
        SELECT a.id, a.name, a.type, a.balance
        FROM accounts a
        JOIN users u ON u.id = a.user_id
        WHERE u.email = %s
          AND (LOWER(a.name) LIKE '%%diners%%' OR LOWER(a.name) LIKE '%%hdfc%%')
        ORDER BY a.name
    """, (email,))
    rows = cur.fetchall()
    if not rows:
        print("ERROR: No HDFC/Diners account found. Available accounts:")
        cur.execute("""
            SELECT a.name, a.type FROM accounts a
            JOIN users u ON u.id = a.user_id WHERE u.email = %s
        """, (email,))
        for r in cur.fetchall():
            print(f"  {r['name']} ({r['type']})")
        sys.exit(1)
    if len(rows) > 1:
        print("Multiple matching accounts found:")
        for i, r in enumerate(rows):
            print(f"  [{i}] {r['name']} (balance: {r['balance']})")
        idx = int(input("Select account index: "))
        return rows[idx]
    return rows[0]


def get_user_id(cur, email: str):
    cur.execute("SELECT id FROM users WHERE email = %s", (email,))
    row = cur.fetchone()
    if not row:
        print(f"ERROR: No user with email {email}")
        sys.exit(1)
    return row["id"]


# ── Duplicate detection ───────────────────────────────────────────────────────

def load_existing_keys(cur, account_id) -> set:
    """Load (date, amount, description_lower) for all existing transactions on this account."""
    cur.execute("""
        SELECT date, amount, LOWER(TRIM(description)) AS desc
        FROM transactions
        WHERE account_id = %s
    """, (account_id,))
    return {(str(r["date"]), str(r["amount"]), r["desc"]) for r in cur.fetchall()}


# ── Date parsing ──────────────────────────────────────────────────────────────

def parse_date(val) -> date:
    """Parse DD/MM/YYYY HH:MM:SS, DD/MM/YYYY HH:MM, DD/MM/YYYY, YYYY-MM-DD -> date"""
    s = str(val).strip()
    # Try stripping time part first — covers all datetime variants
    date_part = s.split(" ")[0]
    for fmt in ("%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(date_part, fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Cannot parse date: {repr(s)}")


# ── Read export xlsx ──────────────────────────────────────────────────────────

def read_export_file(fpath: str) -> list:
    """
    Returns list of dicts: date, description, amount, type ('expense'|'income'), reward_points
    """
    wb = openpyxl.load_workbook(fpath)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    header = [str(h).strip() if h else "" for h in rows[0]]
    col = {h: i for i, h in enumerate(header)}

    required = {"Date", "Description"}
    missing = required - set(col.keys())
    if missing:
        raise ValueError(f"Missing columns in {fpath}: {missing}")

    has_wd = "Withdrawal Amount" in col
    has_dep = "Deposit Amount" in col
    has_rp = "Reward Points" in col

    txns = []
    for row in rows[1:]:
        date_val = row[col["Date"]]
        if not date_val:
            continue

        desc = str(row[col["Description"]]).strip() if row[col["Description"]] else ""
        if not desc:
            continue

        try:
            txn_date = parse_date(date_val)
        except ValueError as e:
            print(f"  WARN: {e} — skipping row")
            continue

        w_amt = row[col["Withdrawal Amount"]] if has_wd else None
        d_amt = row[col["Deposit Amount"]] if has_dep else None
        rp = row[col["Reward Points"]] if has_rp else None

        # Determine type and amount
        if w_amt and str(w_amt).strip() not in ("", "None"):
            try:
                amount = Decimal(str(w_amt)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                txn_type = "expense"
            except:
                continue
        elif d_amt and str(d_amt).strip() not in ("", "None"):
            try:
                amount = Decimal(str(d_amt)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                txn_type = "income"
            except:
                continue
        else:
            continue

        reward_points = None
        if rp and str(rp).strip() not in ("", "None"):
            try:
                reward_points = int(float(str(rp)))
                if reward_points <= 0:
                    reward_points = None
            except:
                reward_points = None

        txns.append({
            "date": txn_date,
            "description": desc,
            "amount": amount,
            "type": txn_type,
            "reward_points": reward_points,
        })

    return txns


# ── Balance update ────────────────────────────────────────────────────────────

def update_balance(cur, account_id, amount: Decimal, txn_type: str):
    """Update credit card balance: expense increases debt, income (payment) reduces it."""
    if txn_type == "expense":
        cur.execute("UPDATE accounts SET balance = balance + %s WHERE id = %s", (amount, account_id))
    else:  # income / payment
        cur.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s", (amount, account_id))


# ── Main import ───────────────────────────────────────────────────────────────

def run_import(email: str, dry_run: bool, year_filter: str = None):
    conn = get_conn()
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    user_id = get_user_id(cur, email)
    account = find_account(cur, email)
    account_id = account["id"]

    print(f"\nAccount : {account['name']} (balance: {account['balance']})")
    print(f"User    : {email}")
    print(f"Dry run : {dry_run}\n")

    existing_keys = load_existing_keys(cur, account_id)
    print(f"Existing transactions in DB: {len(existing_keys)}\n")

    # Collect export files
    patterns = []
    if year_filter:
        patterns.append(os.path.join(EXPORT_BASE, year_filter, "*_export.xlsx"))
    else:
        patterns.append(os.path.join(EXPORT_BASE, "2025", "*_export.xlsx"))
        patterns.append(os.path.join(EXPORT_BASE, "2026", "*_export.xlsx"))

    export_files = sorted(
        f for p in patterns for f in glob.glob(p)
        if "Billedstatements" not in os.path.basename(f)  # skip old-format duplicates
    )
    if not export_files:
        print(f"No export files found under {EXPORT_BASE}")
        sys.exit(1)

    total_new = 0
    total_skipped = 0
    total_errors = 0

    for fpath in export_files:
        fname = os.path.basename(fpath)
        try:
            txns = read_export_file(fpath)
        except Exception as e:
            print(f"ERROR reading {fname}: {e}")
            total_errors += 1
            continue

        new_count = skip_count = 0
        for t in txns:
            key = (str(t["date"]), str(t["amount"]), t["description"].lower().strip())
            if key in existing_keys:
                skip_count += 1
                continue

            if not dry_run:
                txn_id = uuid.uuid4()
                cur.execute("""
                    INSERT INTO transactions
                        (id, user_id, account_id, date, amount, description, type, reward_points, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                """, (
                    txn_id, user_id, account_id,
                    t["date"], t["amount"], t["description"],
                    t["type"], t["reward_points"],
                ))
                update_balance(cur, account_id, t["amount"], t["type"])
                existing_keys.add(key)

            new_count += 1

        status = "would add" if dry_run else "added"
        print(f"  {fname}: {status} {new_count}, skipped {skip_count}")
        total_new += new_count
        total_skipped += skip_count

    print(f"\n{'DRY RUN ' if dry_run else ''}Summary: {total_new} new, {total_skipped} skipped, {total_errors} errors")

    if not dry_run and total_new > 0:
        conn.commit()
        print("Committed to database.")
    else:
        conn.rollback()

    cur.close()
    conn.close()


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import HDFC Diners Club transactions")
    parser.add_argument("--email", default="abhaggl@gmail.com", help="User email")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing to DB")
    parser.add_argument("--year", choices=["2025", "2026"], help="Import only a specific year")
    args = parser.parse_args()

    run_import(email=args.email, dry_run=args.dry_run, year_filter=args.year)
