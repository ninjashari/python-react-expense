"""
One-off backfill: compute opening_balance for every account so that the fixed
recalculate_all_balances endpoint (which now seeds from opening_balance instead
of 0) is a no-op on first run, i.e. it reproduces each account's CURRENT balance.

Replicates the exact loop/condition structure of recalculate_all_balances in
backend/routers/accounts.py (as of this script's writing) to compute the net
effect of all transactions on each account, without mutating `balance`.

net_effect logic per transaction, for a given `account` being evaluated:
  - type in ('income','expense') and txn.account_id == account.id:
        income -> apply update_account_balance style delta
        expense -> apply update_account_balance style delta
  - type == 'transfer':
        if txn.account_id == account.id: treat as 'expense' (debit)
        elif txn.to_account_id == account.id: treat as 'income' (credit)
  - anything else (e.g. a non-transfer row that happens to have to_account_id
    set): NO effect on the to_account_id side, matching current endpoint code.

opening_balance = current_balance - net_effect
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from decimal import Decimal
from database import SessionLocal
from models.accounts import Account
from models.transactions import Transaction


def signed_delta(account_type: str, amount: Decimal, applied_type: str) -> Decimal:
    """Mirrors update_account_balance's sign convention (non-reversal, multiplier=1)."""
    if account_type == 'credit':
        if applied_type == 'income':
            return -amount
        elif applied_type == 'expense':
            return amount
        return Decimal('0.00')
    else:
        if applied_type == 'income':
            return amount
        elif applied_type in ('expense', 'transfer'):
            return -amount
        return Decimal('0.00')


def main():
    db = SessionLocal()
    try:
        accounts = db.query(Account).all()
        print(f"Found {len(accounts)} accounts total")

        results = []
        for account in accounts:
            transactions = db.query(Transaction).filter(
                (Transaction.account_id == account.id) |
                (Transaction.to_account_id == account.id)
            ).order_by(Transaction.date, Transaction.created_at).all()

            net_effect = Decimal('0.00')
            for txn in transactions:
                amount = txn.amount if txn.amount is not None else Decimal('0.00')
                if txn.type in ('income', 'expense') and txn.account_id == account.id:
                    net_effect += signed_delta(account.type, amount, txn.type)
                elif txn.type == 'transfer':
                    if txn.account_id == account.id:
                        net_effect += signed_delta(account.type, amount, 'expense')
                    elif txn.to_account_id == account.id:
                        net_effect += signed_delta(account.type, amount, 'income')
                # else: no effect (matches current endpoint behavior for
                # non-transfer rows that have to_account_id populated)

            current_balance = account.balance if account.balance is not None else Decimal('0.00')
            opening_balance = current_balance - net_effect

            results.append({
                'id': str(account.id),
                'name': account.name,
                'type': account.type,
                'current_balance': current_balance,
                'net_effect': net_effect,
                'opening_balance': opening_balance,
                'txn_count': len(transactions),
            })

        # Print summary before writing
        for r in results:
            print(f"{r['name'][:40]:40s} type={r['type']:10s} txns={r['txn_count']:5d} "
                  f"current={r['current_balance']:>15} net_effect={r['net_effect']:>15} "
                  f"opening_balance={r['opening_balance']:>15}")

        # Apply updates
        for r in results:
            account = db.query(Account).filter(Account.id == r['id']).first()
            account.opening_balance = r['opening_balance']

        db.commit()
        print("\nBackfill committed successfully.")

        # Ground-truth checks
        for name, expected in [
            ("ICICI Bank Demat Linked", Decimal('1944.36')),
            ("ICICI Sapphiro", Decimal('326.00')),
        ]:
            match = [r for r in results if r['name'] == name]
            if match:
                r = match[0]
                ok = abs(r['current_balance'] - expected) < Decimal('0.01')
                print(f"Ground truth check {name}: current_balance={r['current_balance']} "
                      f"expected={expected} match={ok} opening_balance={r['opening_balance']}")
            else:
                print(f"Ground truth check {name}: ACCOUNT NOT FOUND")

    finally:
        db.close()


if __name__ == '__main__':
    main()
