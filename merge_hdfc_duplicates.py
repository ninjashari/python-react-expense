"""
Merge duplicate HDFC Diners Club transactions:
  - For each (date, amount) pair with 2 rows: copy category/payee from old to new, delete old
  - Also reverses the double balance update caused by the duplicate import

Usage:
    python merge_hdfc_duplicates.py [--dry-run]
"""

import os, argparse, psycopg2, psycopg2.extras
from dotenv import load_dotenv
psycopg2.extras.register_uuid()

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env"))
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL is not set; configure it in backend/.env")


def run(dry_run: bool):
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Get HDFC Diners account
    cur.execute("SELECT id, balance, type FROM accounts WHERE LOWER(name) LIKE '%diners%'")
    acct = cur.fetchone()
    acct_id = acct["id"]
    print(f"Account balance before: {acct['balance']}")

    # Find all duplicate (date, amount) groups
    cur.execute("""
        SELECT date, amount, array_agg(id ORDER BY created_at) AS ids
        FROM transactions
        WHERE account_id = %s
        GROUP BY date, amount
        HAVING COUNT(*) > 1
        ORDER BY date, amount
    """, (acct_id,))
    groups = cur.fetchall()
    print(f"Duplicate groups: {len(groups)}\n")

    merged = 0
    balance_adj = 0  # net balance adjustment needed

    for g in groups:
        ids = g["ids"]
        if len(ids) != 2:
            print(f"  SKIP {g['date']} {g['amount']}: {len(ids)} rows (expected 2)")
            continue

        # Load both rows
        cur.execute("""
            SELECT id, description, type, category_id, payee_id, reward_points, created_at
            FROM transactions WHERE id = ANY(%s)
            ORDER BY created_at
        """, (ids,))
        rows = cur.fetchall()
        old, new = rows[0], rows[1]

        # Sanity: old should have no reward_points (or less data), new may have reward_points
        # Identify which is which by reward_points presence and created_at
        # The "old" is the one created before the import run (earlier created_at)
        # The "new" is the one added by our import script

        cat_id   = old["category_id"] or new["category_id"]
        payee_id = old["payee_id"]    or new["payee_id"]
        rp       = new["reward_points"] or old["reward_points"]
        txn_type = new["type"]

        action = f"{g['date']} {g['amount']:>10}  type={txn_type}  " \
                 f"cat={'Y' if cat_id else 'N'}  payee={'Y' if payee_id else 'N'}  " \
                 f"rp={rp}  | old_desc={str(old['description'])[:30]}"
        print(f"  MERGE {action}")

        if not dry_run:
            # Update the NEW transaction with merged category/payee/reward_points
            cur.execute("""
                UPDATE transactions
                SET category_id = %s, payee_id = %s, reward_points = %s
                WHERE id = %s
            """, (cat_id, payee_id, rp, new["id"]))

            # Delete the OLD transaction
            cur.execute("DELETE FROM transactions WHERE id = %s", (old["id"],))

            # Reverse the balance impact of the deleted (old) transaction
            # credit card: expense increases balance (debt), income decreases it
            if txn_type == "expense":
                cur.execute("UPDATE accounts SET balance = balance - %s WHERE id = %s",
                            (g["amount"], acct_id))
                balance_adj -= float(g["amount"])
            else:  # income/payment
                cur.execute("UPDATE accounts SET balance = balance + %s WHERE id = %s",
                            (g["amount"], acct_id))
                balance_adj += float(g["amount"])

        merged += 1

    # Show final balance
    if not dry_run and merged > 0:
        conn.commit()
        cur.execute("SELECT balance FROM accounts WHERE id = %s", (acct_id,))
        new_bal = cur.fetchone()["balance"]
        print(f"\nMerged: {merged} pairs")
        print(f"Balance adjustment: {balance_adj:+.2f}")
        print(f"Account balance after: {new_bal}")
        print("Committed.")
    else:
        conn.rollback()
        print(f"\n{'DRY RUN — ' if dry_run else ''}would merge {merged} pairs")

    cur.close()
    conn.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    run(dry_run=args.dry_run)
