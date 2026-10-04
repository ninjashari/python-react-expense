"""Mongo-native balance recalculation - the analogue of migrate_transaction_balances.py
for MongoDB, reusing services.balance_logic.compute_balance_after so the exact same
math backs both stores. Doubles as an independent correctness cross-check: run it and
diff its output against Postgres's account.balance / balance_after_transaction to
confirm the two stores agree.

Usage:
    python -m scripts.recalculate_mongo_balances [--user-id <uuid>] [--account-id <uuid>]
"""
import argparse
import asyncio
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from database_mongo import init_mongo
from models_mongo.accounts import AccountDocument
from models_mongo.transactions import TransactionDocument
from services.balance_logic import compute_balance_after


async def recalculate_account(account: AccountDocument) -> int:
    txns = await TransactionDocument.find(
        (TransactionDocument.account_id == account.id) | (TransactionDocument.to_account_id == account.id)
    ).sort("+date", "+created_at").to_list()

    running_balance = Decimal(str(account.opening_balance or 0))
    updated = 0

    for txn in txns:
        if txn.account_id == account.id:
            new_balance = compute_balance_after(running_balance, txn.amount, account.type, txn.type)
            if float(new_balance) != txn.balance_after_transaction:
                txn.balance_after_transaction = float(new_balance)
                await txn.save()
                updated += 1
            running_balance = new_balance
        elif txn.to_account_id == account.id and txn.type == "transfer":
            new_balance = compute_balance_after(running_balance, txn.amount, account.type, "income")
            if float(new_balance) != txn.to_account_balance_after:
                txn.to_account_balance_after = float(new_balance)
                await txn.save()
                updated += 1
            running_balance = new_balance

    if float(running_balance) != account.balance:
        account.balance = float(running_balance)
        await account.save()

    return updated


async def main(user_id_filter, account_id_filter):
    await init_mongo()

    query = {}
    if user_id_filter:
        query["user_id"] = user_id_filter
    if account_id_filter:
        query["_id"] = account_id_filter

    accounts = await AccountDocument.find(query).to_list() if query else await AccountDocument.find_all().to_list()

    total_updated = 0
    for account in accounts:
        updated = await recalculate_account(account)
        total_updated += updated
        print(f"account {account.id} ({account.name}): {updated} transactions updated, final balance {account.balance}")

    print(f"Total transactions updated: {total_updated}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Recalculate MongoDB balances.")
    parser.add_argument("--user-id", type=str, default=None)
    parser.add_argument("--account-id", type=str, default=None)
    args = parser.parse_args()
    asyncio.run(main(args.user_id, args.account_id))
