"""Check for transactions in export files that are missing from the DB."""
import glob, os, openpyxl, psycopg2, psycopg2.extras
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env"))
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL is not set; configure it in backend/.env")

psycopg2.extras.register_uuid()
conn = psycopg2.connect(DB_URL)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# DB transactions
cur.execute("""
    SELECT t.id, t.date, t.amount, t.description, t.type
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    WHERE LOWER(a.name) LIKE '%diners%'
    ORDER BY date, amount
""")
db_rows = cur.fetchall()
db_keys = {(str(r['date']), str(r['amount'])): r for r in db_rows}
print(f'DB transactions: {len(db_rows)}')

# Export file transactions
EXPORT_BASE = r'D:\Documents\Finances\Credit Cards\HDFC Diners Club Privilege\Export Statement'
patterns = [
    os.path.join(EXPORT_BASE, '2025', '*_export.xlsx'),
    os.path.join(EXPORT_BASE, '2026', '*_export.xlsx'),
]
files = sorted(
    f for p in patterns for f in glob.glob(p)
    if 'Billedstatements' not in os.path.basename(f)
)
print(f'Export files: {len(files)}')

export_txns = []
for fpath in files:
    wb = openpyxl.load_workbook(fpath)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        continue
    header = [str(h).strip() if h else '' for h in rows[0]]
    col = {h: i for i, h in enumerate(header)}
    for row in rows[1:]:
        dv = row[col.get('Date', 0)]
        if not dv:
            continue
        desc = str(row[col.get('Description', 1)]).strip() if row[col.get('Description', 1)] else ''
        if not desc:
            continue
        s = str(dv).strip()
        dp = s.split(' ')[0]
        txn_date = None
        for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
            try:
                txn_date = datetime.strptime(dp, fmt).date()
                break
            except ValueError:
                pass
        if not txn_date:
            continue
        w = row[col.get('Withdrawal Amount', 2)]
        d = row[col.get('Deposit Amount', 3)]
        if w and str(w).strip() not in ('', 'None'):
            try:
                amt = Decimal(str(w)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                txn_type = 'expense'
            except Exception:
                continue
        elif d and str(d).strip() not in ('', 'None'):
            try:
                amt = Decimal(str(d)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                txn_type = 'income'
            except Exception:
                continue
        else:
            continue
        export_txns.append({
            'date': txn_date,
            'amount': amt,
            'desc': desc,
            'type': txn_type,
            'file': os.path.basename(fpath),
        })

print(f'Export transactions: {len(export_txns)}')

# Find missing from DB (by date + amount)
missing = [t for t in export_txns if (str(t['date']), str(t['amount'])) not in db_keys]
print(f'\nMissing from DB: {len(missing)}')
for t in missing:
    print(f'  {t["date"]}  {t["amount"]:>10}  {t["type"]:7}  {t["desc"][:55]}  [{t["file"]}]')

conn.close()
