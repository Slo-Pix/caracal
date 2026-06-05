"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Validates the Slate Ledger provider: bearer-token access, double-entry posting and reversal, asynchronous reconciliation, accrual schedules, trial balance, and gated fiscal-period close.
"""
from __future__ import annotations

import os

os.environ.setdefault("PROVIDERLAB_FAST", "1")

from fastapi.testclient import TestClient

from _mock.providerlab import catalog, credentials
from _mock.providerlab.app import build_app


def _client() -> TestClient:
    return TestClient(build_app(catalog.get("slate-ledger")))


def _token() -> str:
    return credentials.load("slate-ledger").data["seed"]["bearerToken"]


def _api(c: TestClient, op: str, body: dict):
    return c.post(f"/api/{op}", json=body, headers={"Authorization": f"Bearer {_token()}"})


def test_bearer_required():
    c = _client()
    assert c.post("/api/list_accounts", json={}).status_code == 401
    assert c.post("/api/list_accounts", json={},
                  headers={"Authorization": "Bearer nope"}).status_code == 401
    assert _api(c, "list_accounts", {}).status_code == 200


def test_chart_of_accounts_has_normal_balances():
    c = _client()
    body = _api(c, "list_accounts", {"type": "liability"}).json()["data"]
    assert body["total"] >= 4
    ap = _api(c, "get_account", {"accountId": "2000"}).json()["data"]
    assert ap["name"] == "Accounts Payable"
    assert ap["normalBalance"] == "credit" and ap["isControlAccount"] is True
    assert _api(c, "get_account", {"accountId": "0000"}).status_code == 404


def test_double_entry_posting_updates_balances():
    c = _client()
    before = _api(c, "get_account", {"accountId": "6200"}).json()["data"]["balance"]
    posted = _api(c, "post_entry", {
        "period": "2026-01",
        "description": "Cloud subscription",
        "lines": [{"accountNo": "6200", "debit": 5000}, {"accountNo": "2000", "credit": 5000}],
    })
    assert posted.status_code == 200
    entry = posted.json()["data"]
    assert entry["status"] == "posted" and entry["totalDebit"] == entry["totalCredit"] == 5000.0
    after = _api(c, "get_account", {"accountId": "6200"}).json()["data"]["balance"]
    assert round(after - before, 2) == 5000.0


def test_post_entry_rejects_unbalanced_and_unknown_account():
    c = _client()
    bad = _api(c, "post_entry", {"lines": [{"debit": 10}, {"credit": 5}]})
    assert bad.status_code == 422 and bad.json()["error"] == "unbalanced"
    unknown = _api(c, "post_entry", {"lines": [{"accountNo": "9999", "debit": 5}, {"credit": 5}]})
    assert unknown.status_code == 422 and unknown.json()["error"] == "invalid_account"


def test_reverse_entry_is_idempotent_per_original():
    c = _client()
    jid = _api(c, "post_entry", {
        "period": "2026-01",
        "lines": [{"accountNo": "6300", "debit": 1200}, {"accountNo": "2100", "credit": 1200}],
    }).json()["data"]["journalId"]
    rev = _api(c, "reverse_entry", {"entryId": jid}).json()["data"]
    assert rev["type"] == "reversal" and rev["reversalOf"] == jid
    assert rev["totalDebit"] == 1200.0 and rev["lines"][0]["credit"] == 1200.0
    again = _api(c, "reverse_entry", {"entryId": jid})
    assert again.status_code == 409 and again.json()["error"] == "already_reversed"


def test_reconciliation_is_asynchronous():
    c = _client()
    started = _api(c, "reconcile_account", {"accountId": "1000"}).json()["data"]
    assert started["status"] == "in_progress" and "reconciliationId" in started
    settled = _api(c, "get_reconciliation",
                   {"reconciliationId": started["reconciliationId"]}).json()["data"]
    assert settled["status"] == "balanced" and settled["difference"] == 0.0

    diff = _api(c, "reconcile_account", {
        "accountId": "1000", "statementBalance": 1_000_000,
        "outstandingItems": [{"amount": 250.0, "type": "deposit_in_transit"}],
    }).json()["data"]
    exc = _api(c, "get_reconciliation", {"reconciliationId": diff["reconciliationId"]}).json()["data"]
    assert exc["status"] == "exception" and exc["outstandingTotal"] == 250.0


def test_accrual_schedule_amortizes():
    c = _client()
    acr = _api(c, "create_accrual",
               {"amount": 120000, "periods": 12, "description": "External audit"}).json()["data"]
    assert acr["perPeriod"] == 10000.0 and acr["status"] == "active"
    assert _api(c, "create_accrual", {"amount": 1000, "periods": 0}).status_code == 422


def test_trial_balance_is_balanced():
    c = _client()
    tb = _api(c, "trial_balance", {}).json()["data"]
    assert tb["balanced"] is True and tb["totalDebit"] == tb["totalCredit"]
    assert any(row["accountNo"] == "2000" for row in tb["rows"])


def test_close_is_gated_then_locks_the_period():
    c = _client()
    pending = _api(c, "reconcile_account", {"accountId": "1020", "period": "2026-02"}).json()["data"]
    blocked = _api(c, "close_period", {"period": "2026-02"})
    assert blocked.status_code == 409 and blocked.json()["error"] == "reconciliations_incomplete"
    _api(c, "get_reconciliation", {"reconciliationId": pending["reconciliationId"]})

    closed = _api(c, "close_period", {"period": "2026-02"}).json()["data"]
    assert closed["status"] == "closed"
    assert all(task["status"] == "complete" for task in closed["checklist"])
    assert _api(c, "close_period", {"period": "2026-02"}).status_code == 409
    locked = _api(c, "post_entry", {"period": "2026-02", "lines": [{"debit": 1}, {"credit": 1}]})
    assert locked.status_code == 409 and locked.json()["error"] == "period_closed"
