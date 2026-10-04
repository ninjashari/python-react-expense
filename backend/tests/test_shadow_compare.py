from decimal import Decimal

from scripts.shadow_compare import diff_payloads


def test_identical_dicts_match():
    assert diff_payloads({"id": "1", "amount": 10}, {"id": "1", "amount": 10}) == []


def test_decimal_and_float_of_equal_value_match():
    assert diff_payloads({"amount": Decimal("200.00")}, {"amount": 200.0}) == []


def test_mismatched_field_value_reported():
    diffs = diff_payloads({"id": "1", "amount": 10}, {"id": "1", "amount": 11})
    assert len(diffs) == 1
    assert ".amount" in diffs[0]


def test_missing_field_reported_with_source():
    diffs = diff_payloads({"id": "1"}, {"id": "1", "extra": "x"})
    assert diffs == [".extra: missing in postgres result"]


def test_lists_compared_out_of_order_via_list_key():
    pg = [{"id": "b", "v": 2}, {"id": "a", "v": 1}]
    mongo = [{"id": "a", "v": 1}, {"id": "b", "v": 2}]
    assert diff_payloads(pg, mongo, list_key="id") == []


def test_list_length_mismatch_reported():
    diffs = diff_payloads([{"id": "a"}], [{"id": "a"}, {"id": "b"}])
    assert len(diffs) == 1
    assert "length mismatch" in diffs[0]


def test_date_like_values_normalized_to_isoformat():
    from datetime import date

    assert diff_payloads({"date": date(2024, 1, 1)}, {"date": date(2024, 1, 1)}) == []
