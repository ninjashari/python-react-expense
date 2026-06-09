import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env"))
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL is not set; configure it in backend/.env")

c = psycopg2.connect(DB_URL)
cur = c.cursor()
cur.execute("SELECT id, name FROM categories WHERE name ILIKE '%cloth%'")
print(cur.fetchall())
