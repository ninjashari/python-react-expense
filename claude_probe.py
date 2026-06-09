import os
import psycopg2, json
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env"))
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL is not set; configure it in backend/.env")

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Uncategorized transactions
cur.execute("""
    SELECT t.id, t.description, t.amount, t.type, t.date, 
           a.name as account, c.name as cat, p.name as payee
    FROM transactions t 
    LEFT JOIN accounts a ON t.account_id=a.id 
    LEFT JOIN categories c ON t.category_id=c.id 
    LEFT JOIN payees p ON t.payee_id=p.id 
    WHERE t.category_id IS NULL OR t.payee_id IS NULL 
    ORDER BY t.date DESC
""")
rows = cur.fetchall()
print("=== UNCATEGORIZED ===")
for r in rows:
    print(r)

# Top selection history patterns
cur.execute("""
    SELECT transaction_description, selected_value_name, field_type, COUNT(*) as freq
    FROM user_selection_history
    GROUP BY transaction_description, selected_value_name, field_type
    ORDER BY freq DESC LIMIT 10
""")
print("\n=== TOP PATTERNS ===")
for r in cur.fetchall():
    print(r)

# All categories
cur.execute("SELECT id, name FROM categories ORDER BY name")
print("\n=== CATEGORIES ===")
for r in cur.fetchall():
    print(r)
