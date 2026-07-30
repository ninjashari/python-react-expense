"""
Read-only sanity check for the Group B running-principal replay algorithm
(services/investment_service.replay_category_transactions). No DB access needed —
exercises the pure function directly against the user's own example scenario.

Run with:  python -m scripts.verify_investment_replay   (from the backend/ directory)
"""
import sys
import os
from decimal import Decimal
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.investment_service import ReplayTxn, replay_category_transactions

ACCOUNT_ID = "checking-account"
ACCOUNT_NAME = "Checking"


def txn(id_, day, direction, amount):
    return ReplayTxn(
        id=id_,
        date=date(2024, 1, day),
        direction=direction,
        amount=Decimal(str(amount)),
        account_id=ACCOUNT_ID,
        account_name=ACCOUNT_NAME,
    )


def check(label, actual, expected):
    status = "OK" if actual == expected else "FAIL"
    print(f"[{status}] {label}: expected={expected!r} actual={actual!r}")
    return actual == expected


def main():
    all_ok = True

    # Scenario from the user's own description: invest 10k, withdraw 12k (closes out with a
    # 2k profit), then invest 5k more (a fresh, untouched cycle).
    txns = [
        txn(1, 1, 'invested', 10_000),
        txn(2, 15, 'withdrawn', 12_000),
        txn(3, 20, 'invested', 5_000),
    ]
    result = replay_category_transactions(txns)

    all_ok &= check("final running_principal", result.running_principal, Decimal('5000'))
    all_ok &= check("final realized_gain_loss", result.realized_gain_loss, Decimal('2000'))

    withdraw_event = result.events[1]
    all_ok &= check("mid-sequence running_principal_after (post-withdraw)", withdraw_event.running_principal_after, Decimal('0'))
    all_ok &= check("mid-sequence realized_gain_loss_delta (post-withdraw)", withdraw_event.realized_gain_loss_delta, Decimal('2000'))

    invest_event_2 = result.events[2]
    all_ok &= check("post second invest running_principal_after", invest_event_2.running_principal_after, Decimal('5000'))
    all_ok &= check("post second invest realized_gain_loss_delta", invest_event_2.realized_gain_loss_delta, Decimal('0'))

    # Partial withdrawal (amount <= running_principal): no gain/loss signal, just a principal
    # reduction.
    txns_partial = [
        txn(1, 1, 'invested', 10_000),
        txn(2, 10, 'withdrawn', 4_000),
    ]
    result_partial = replay_category_transactions(txns_partial)
    all_ok &= check("partial withdrawal running_principal", result_partial.running_principal, Decimal('6000'))
    all_ok &= check("partial withdrawal realized_gain_loss", result_partial.realized_gain_loss, Decimal('0'))

    # Loss is never inferred: a withdrawal exactly matching principal closes the position with
    # zero realized gain/loss, even though in reality it might represent a loss.
    txns_exact = [
        txn(1, 1, 'invested', 10_000),
        txn(2, 10, 'withdrawn', 10_000),
    ]
    result_exact = replay_category_transactions(txns_exact)
    all_ok &= check("exact withdrawal running_principal", result_exact.running_principal, Decimal('0'))
    all_ok &= check("exact withdrawal realized_gain_loss (never negative)", result_exact.realized_gain_loss, Decimal('0'))

    # Out-of-order input is sorted internally by date before replay.
    txns_unsorted = [
        txn(2, 15, 'withdrawn', 12_000),
        txn(1, 1, 'invested', 10_000),
        txn(3, 20, 'invested', 5_000),
    ]
    result_unsorted = replay_category_transactions(txns_unsorted)
    all_ok &= check("unsorted input still replays correctly", result_unsorted.realized_gain_loss, Decimal('2000'))

    print()
    print("ALL CHECKS PASSED" if all_ok else "SOME CHECKS FAILED")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
