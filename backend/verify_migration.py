#!/usr/bin/env python3
from database import SessionLocal
from models.transactions import Transaction
from sqlalchemy.orm import joinedload

db = SessionLocal()
transactions = db.query(Transaction).options(
    joinedload(Transaction.account)
).order_by(Transaction.date.asc()).limit(5).all()

print('Sample transactions with running balances:')
for i, t in enumerate(transactions):
    print(f'{i+1}. {t.date} | {t.account.name} | {t.type} | ${t.amount} | Balance after: ${t.balance_after_transaction}')
    if t.to_account_balance_after:
        print(f'   Transfer to-account balance after: ${t.to_account_balance_after}')

# Check transfer transactions specifically
transfers = db.query(Transaction).filter(Transaction.type == "transfer").limit(3).all()
print('\nTransfer transactions:')
for i, t in enumerate(transfers):
    print(f'{i+1}. {t.date} | {t.type} | ${t.amount}')
    print(f'   Source balance after: ${t.balance_after_transaction}')
    print(f'   Destination balance after: ${t.to_account_balance_after}')

db.close()