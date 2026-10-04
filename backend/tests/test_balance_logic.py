from decimal import Decimal

from services.balance_logic import compute_balance_after


def test_regular_account_income_adds():
    assert compute_balance_after(100, 50, "checking", "income") == Decimal("150")


def test_regular_account_expense_subtracts():
    assert compute_balance_after(100, 50, "checking", "expense") == Decimal("50")


def test_credit_account_income_payment_reduces_debt():
    # Credit card balance represents amount owed; a payment (income) reduces it.
    assert compute_balance_after(100, 30, "credit", "income") == Decimal("70")


def test_credit_account_expense_charge_increases_debt():
    assert compute_balance_after(100, 30, "credit", "expense") == Decimal("130")


def test_transfer_source_side_uses_expense_semantics():
    # Callers pass transaction_type="expense" for the source side of a transfer.
    assert compute_balance_after(200, 50, "savings", "expense") == Decimal("150")


def test_transfer_destination_side_uses_income_semantics():
    # Callers pass transaction_type="income" for the destination side of a transfer.
    assert compute_balance_after(200, 50, "checking", "income") == Decimal("250")


def test_unknown_transaction_type_leaves_balance_unchanged():
    assert compute_balance_after(100, 50, "checking", "transfer") == Decimal("100")


def test_accepts_float_and_string_inputs():
    assert compute_balance_after(100.0, "25.50", "checking", "expense") == Decimal("74.50")
