"""Mirror-function tests: given a Postgres row (a plain stand-in object shaped
like the SQLAlchemy model), mirror_* builds a Mongo document with matching
fields - including embedded snapshots - and writes it via Beanie.

Beanie's Document.get/insert/find are monkeypatched at the class level (rather
than running against a live Mongo server) so these tests stay hermetic; only
Document.get_pymongo_collection is stubbed to avoid needing init_beanie().
"""
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from beanie import Document

from services import mongo_sync
from models_mongo.transactions import TransactionDocument
from models_mongo.accounts import AccountDocument


def _fake_query_first(return_value):
    """A chainable stand-in for db.query(...).options(...).filter(...).first()."""
    chain = SimpleNamespace()
    chain.options = lambda *a, **k: chain
    chain.filter = lambda *a, **k: chain
    chain.first = lambda: return_value
    return chain


@pytest.fixture(autouse=True)
def mongo_ready(monkeypatch):
    monkeypatch.setattr(mongo_sync, "ensure_mongo_ready", AsyncMock(return_value=True))
    # Documents only need a collection handle to be constructed; stub it out
    # rather than standing up a real (or mocked) Mongo connection via init_beanie.
    monkeypatch.setattr(Document, "get_pymongo_collection", classmethod(lambda cls: MagicMock()))


@pytest.mark.asyncio
async def test_mirror_transaction_upsert_includes_embedded_snapshots(monkeypatch):
    account = SimpleNamespace(id="acc-1", name="Checking", type="checking")
    category = SimpleNamespace(id="cat-1", name="Groceries", color="#ff0000")
    payee = SimpleNamespace(id="payee-1", name="Whole Foods", color="#00ff00")

    txn = SimpleNamespace(
        id="txn-1", user_id="user-1", account_id="acc-1", to_account_id=None,
        category_id="cat-1", payee_id="payee-1", amount=42.5, type="expense",
        description="groceries", notes=None, date=date(2025, 1, 1),
        balance_after_transaction=957.5, to_account_balance_after=None,
        reward_points=None, account=account, to_account=None,
        category=category, payee=payee, created_at=None, updated_at=None,
    )
    db = SimpleNamespace(query=lambda model: _fake_query_first(txn))

    inserted = []
    monkeypatch.setattr(TransactionDocument, "get", AsyncMock(return_value=None))

    async def fake_insert(self):
        inserted.append(self)
        return self

    monkeypatch.setattr(TransactionDocument, "insert", fake_insert)

    await mongo_sync.mirror_transaction_upsert(db, "txn-1")

    assert len(inserted) == 1
    doc = inserted[0]
    assert doc.id == "txn-1"
    assert doc.amount == 42.5
    assert doc.account.name == "Checking"
    assert doc.category.name == "Groceries"
    assert doc.category.color == "#ff0000"
    assert doc.payee.name == "Whole Foods"
    assert doc.to_account is None


@pytest.mark.asyncio
async def test_mirror_transaction_upsert_updates_existing_document(monkeypatch):
    account = SimpleNamespace(id="acc-1", name="Checking", type="checking")
    txn = SimpleNamespace(
        id="txn-2", user_id="user-1", account_id="acc-1", to_account_id=None,
        category_id=None, payee_id=None, amount=20.0, type="income",
        description=None, notes=None, date=date(2025, 1, 2),
        balance_after_transaction=100.0, to_account_balance_after=None,
        reward_points=None, account=account, to_account=None,
        category=None, payee=None, created_at=None, updated_at=None,
    )
    db = SimpleNamespace(query=lambda model: _fake_query_first(txn))

    existing = MagicMock()
    existing.set = AsyncMock()
    monkeypatch.setattr(TransactionDocument, "get", AsyncMock(return_value=existing))

    await mongo_sync.mirror_transaction_upsert(db, "txn-2")

    existing.set.assert_awaited_once()
    updated_fields = existing.set.call_args[0][0]
    assert updated_fields["amount"] == 20.0
    assert "id" not in updated_fields
    assert "amount" in updated_fields  # sanity: a genuine field diff, not empty


@pytest.mark.asyncio
async def test_mirror_transaction_upsert_missing_row_is_noop(monkeypatch):
    db = SimpleNamespace(query=lambda model: _fake_query_first(None))

    get_mock = AsyncMock()
    monkeypatch.setattr(TransactionDocument, "get", get_mock)

    await mongo_sync.mirror_transaction_upsert(db, "missing-id")

    get_mock.assert_not_awaited()


@pytest.mark.asyncio
async def test_mirror_account_upsert_builds_matching_document(monkeypatch):
    account = SimpleNamespace(
        id="acc-2", user_id="user-1", name="Savings", type="savings",
        balance=1000.0, opening_balance=0.0, account_number=None,
        card_number=None, card_expiry_month=None, card_expiry_year=None,
        credit_limit=None, bill_generation_date=None, payment_due_date=None,
        interest_rate=None, status="active", opening_date=date(2024, 1, 1),
        currency="INR", created_at=None, updated_at=None,
    )
    db = SimpleNamespace(query=lambda model: _fake_query_first(account))

    inserted = []
    monkeypatch.setattr(AccountDocument, "get", AsyncMock(return_value=None))

    async def fake_insert(self):
        inserted.append(self)
        return self

    monkeypatch.setattr(AccountDocument, "insert", fake_insert)

    find_result = MagicMock()
    find_result.set = AsyncMock()
    monkeypatch.setattr(TransactionDocument, "find", MagicMock(return_value=find_result))

    await mongo_sync.mirror_account_upsert(db, "acc-2")

    assert len(inserted) == 1
    assert inserted[0].name == "Savings"
    assert inserted[0].balance == 1000.0
    # Fans out the updated embedded snapshot to referencing transactions on both sides.
    assert find_result.set.await_count == 2


@pytest.mark.asyncio
async def test_failures_are_logged_not_raised():
    def boom(model):
        raise RuntimeError("db exploded")

    db = SimpleNamespace(query=boom)

    # Must not raise - dual-write failures are swallowed, Postgres stays the
    # durability boundary.
    await mongo_sync.mirror_transaction_upsert(db, "txn-x")
    await mongo_sync.mirror_account_upsert(db, "acc-x")
