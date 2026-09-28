"""Pure balance-math helpers shared by the Postgres codepath and any Mongo-native
code (recalculate_mongo_balances.py, tests). No DB session, no I/O - primitives in,
primitives out - so the same logic can be exercised identically against either store.
"""
from decimal import Decimal
from typing import Union

Number = Union[int, float, Decimal]


def compute_balance_after(
    current_balance: Number,
    amount: Number,
    account_type: str,
    transaction_type: str,
) -> Decimal:
    """Calculate the account balance after applying one transaction.

    account_type: e.g. 'credit', 'checking', 'savings', 'cash', ...
    transaction_type: 'income' | 'expense' | 'transfer'

    For a 'transfer', the caller must pass 'income' when this account is the
    destination side of the transfer and 'expense' when it is the source side -
    mirroring how update_account_balance/calculate_balance_after_transaction in
    routers/transactions.py invoke the two sides of a transfer separately.
    """
    current_balance = Decimal(str(current_balance))
    amount = Decimal(str(amount))

    if account_type == "credit":
        # Credit cards: balance represents amount owed.
        if transaction_type == "income":  # Payment to credit card
            return current_balance - amount
        elif transaction_type == "expense":  # Charge on credit card
            return current_balance + amount
        return current_balance

    # Regular accounts: balance represents money available.
    if transaction_type == "income":
        return current_balance + amount
    elif transaction_type == "expense":
        return current_balance - amount
    return current_balance
