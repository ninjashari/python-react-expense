"""
Import transactions parsed from today's downloaded Actual Statement files
(all_parsed_transactions.json, produced by parse_statements.py) into the
expense manager Postgres DB. Dedups against existing transactions, inserts
only missing rows, sets reward_points for credit cards, and updates account
balances using the same sign convention as backend/routers/transactions.py's
update_account_balance().

Usage:
    python import_todays_statements.py [--dry-run] [--account "Name substring"]
"""
import os, sys, json, re, uuid, argparse
from decimal import Decimal, ROUND_HALF_UP

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

psycopg2.extras.register_uuid()
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env"))
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL is not set; configure it in backend/.env")

USER_EMAIL = "abhaggl@gmail.com"
JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "all_parsed_transactions.json")

SELF_TRANSFER_RE = re.compile(r'(^|[/\-])self($|[/\-])', re.I)
MF_RE = re.compile(r'[/\-]mf[/]?$', re.I)
BILLPAY_RE = re.compile(r'cc\s*billpay', re.I)


def D(v):
    return Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def infer_type(desc, withdrawal, deposit):
    is_transfer = bool(SELF_TRANSFER_RE.search(desc) or MF_RE.search(desc) or BILLPAY_RE.search(desc))
    if withdrawal > 0:
        return "transfer" if is_transfer else "expense"
    else:
        return "transfer" if is_transfer else "income"


def update_balance(cur, account_id, account_type, amount: Decimal, txn_type: str):
    if account_type == "credit":
        if txn_type == "income":
            cur.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s", (amount, account_id))
        elif txn_type == "expense":
            cur.execute("UPDATE accounts SET balance = balance + %s WHERE id = %s", (amount, account_id))
        # transfers not expected on credit card accounts in this dataset
    else:
        if txn_type == "income":
            cur.execute("UPDATE accounts SET balance = balance + %s WHERE id = %s", (amount, account_id))
        elif txn_type in ("expense", "transfer"):
            cur.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s", (amount, account_id))


def find_account(cur, name_hint):
    cur.execute("""
        SELECT a.id, a.name, a.type, a.balance
        FROM accounts a JOIN users u ON u.id = a.user_id
        WHERE u.email = %s AND LOWER(a.name) = LOWER(%s)
    """, (USER_EMAIL, name_hint))
    row = cur.fetchone()
    if row:
        return row
    # fallback: fuzzy contains match
    cur.execute("""
        SELECT a.id, a.name, a.type, a.balance
        FROM accounts a JOIN users u ON u.id = a.user_id
        WHERE u.email = %s AND LOWER(a.name) LIKE LOWER(%s)
    """, (USER_EMAIL, f"%{name_hint}%"))
    rows = cur.fetchall()
    if len(rows) == 1:
        return rows[0]
    return None


def load_existing_keys(cur, account_id):
    cur.execute("""
        SELECT date, amount, type, LOWER(TRIM(description)) AS desc
        FROM transactions WHERE account_id = %s
    """, (account_id,))
    precise, loose = set(), set()
    for r in cur.fetchall():
        precise.add((str(r["date"]), str(r["amount"]), r["type"], r["desc"]))
        loose.add((str(r["date"]), str(r["amount"]), r["type"]))
    return precise, loose


def run(dry_run: bool, account_filter: str = None):
    with open(JSON_PATH) as f:
        data = json.load(f)

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("SELECT id FROM users WHERE email = %s", (USER_EMAIL,))
    row = cur.fetchone()
    if not row:
        print(f"ERROR: no user with email {USER_EMAIL}")
        sys.exit(1)
    user_id = row["id"]

    grand_inserted = grand_skipped_exact = grand_skipped_loose = 0

    for account_name, txns in data.items():
        if account_filter and account_filter.lower() not in account_name.lower():
            continue

        account = find_account(cur, account_name)
        if not account:
            print(f"WARN: could not find account for '{account_name}' — skipping {len(txns)} txns")
            continue

        account_id, acct_type = account["id"], account["type"]
        precise_keys, loose_keys = load_existing_keys(cur, account_id)

        inserted = skipped_exact = skipped_loose = 0
        print(f"\n=== {account_name} ({acct_type}, current balance {account['balance']}) ===")

        for t in txns:
            txn_date = t["date"]
            withdrawal = D(t["withdrawal"])
            deposit = D(t["deposit"])
            desc = t["description"]
            amount = withdrawal if withdrawal > 0 else deposit
            txn_type = infer_type(desc, withdrawal, deposit)
            reward_points = t.get("reward_points")

            precise_key = (txn_date, str(amount), txn_type, desc.lower().strip())
            loose_key = (txn_date, str(amount), txn_type)

            if precise_key in precise_keys:
                skipped_exact += 1
                continue
            if loose_key in loose_keys:
                skipped_loose += 1
                print(f"  SKIP (loose dup, desc differs): {txn_date} {amount} {txn_type} :: {desc[:70]}")
                continue

            if not dry_run:
                txn_id = uuid.uuid4()
                cur.execute("""
                    INSERT INTO transactions
                        (id, user_id, account_id, date, amount, description, type, reward_points, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                """, (txn_id, user_id, account_id, txn_date, amount, desc, txn_type, reward_points))
                update_balance(cur, account_id, acct_type, amount, txn_type)
                precise_keys.add(precise_key)
                loose_keys.add(loose_key)

            inserted += 1
            print(f"  {'WOULD ADD' if dry_run else 'ADDED'}: {txn_date} {txn_type:8s} {amount:>10} rp={reward_points}  {desc[:70]}")

        print(f"  -> inserted {inserted}, skipped_exact {skipped_exact}, skipped_loose {skipped_loose}")
        grand_inserted += inserted
        grand_skipped_exact += skipped_exact
        grand_skipped_loose += skipped_loose

        if not dry_run:
            cur.execute("SELECT balance FROM accounts WHERE id = %s", (account_id,))
            print(f"  New balance: {cur.fetchone()['balance']}")

    print(f"\n{'DRY RUN ' if dry_run else ''}TOTAL: inserted {grand_inserted}, "
          f"skipped_exact {grand_skipped_exact}, skipped_loose {grand_skipped_loose}")

    if not dry_run and grand_inserted > 0:
        conn.commit()
        print("Committed to database.")
    else:
        conn.rollback()
        print("Rolled back (dry run or nothing to insert).")

    cur.close()
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--account", default=None, help="Only process accounts whose name contains this substring")
    args = parser.parse_args()
    run(dry_run=args.dry_run, account_filter=args.account)
