"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Validates the application partner integration layer authenticating to every external provider category over its real surface.
"""
from __future__ import annotations

import os

import pytest

from app.agents import tools as tool_fns
from app.services import partners


@pytest.fixture(autouse=True)
def _reset_partners():
    partners.reset()
    yield
    partners.reset()


# --------------------------------------------------------------------------- #
# Catalog
# --------------------------------------------------------------------------- #
def test_partner_catalog_covers_sixteen():
    assert len(partners.catalog()) == 16


def test_partner_catalog_auth_kinds():
    auths = {s.auth for s in partners.catalog().values()}
    assert auths == {"api_key", "bearer", "oauth_cc", "oauth_ac", "none", "mcp_bearer", "mandate"}


# --------------------------------------------------------------------------- #
# api_key (header vs query) — distinct cases
# --------------------------------------------------------------------------- #
def test_api_key_header_charge_idempotent(providerlab):
    first = partners.call("aurum-pay", "create_charge",
                          {"amount": 1200, "currency": "USD", "source": "tok_visa", "idempotencyKey": "idem-1"})
    assert first["data"]["status"] == "succeeded"
    again = partners.call("aurum-pay", "create_charge",
                          {"amount": 1200, "currency": "USD", "source": "tok_visa", "idempotencyKey": "idem-1"})
    assert again["data"]["chargeId"] == first["data"]["chargeId"]


def test_api_key_header_insufficient_funds(providerlab):
    res = partners.call("aurum-pay", "create_charge",
                        {"amount": 99999, "currency": "USD", "source": "tok_visa"})
    assert res["status"] == 402
    assert res["error"] == "insufficient_funds"


def test_api_key_query_async_job(providerlab):
    job = partners.call("quill-ocr", "extract_document", {"documentUrl": "https://x/inv.pdf"})
    assert job["data"]["status"] == "processing"
    done = partners.call("quill-ocr", "get_job", {"jobId": job["data"]["jobId"]})
    assert done["data"]["status"] == "completed"


def test_api_key_missing_credential_raises(providerlab):
    saved = os.environ.pop("LYNX_PARTNER_AURUM_PAY_API_KEY")
    try:
        with pytest.raises(partners.PartnerError):
            partners.call("aurum-pay", "get_balance", {})
    finally:
        os.environ["LYNX_PARTNER_AURUM_PAY_API_KEY"] = saved


# --------------------------------------------------------------------------- #
# bearer (standard vs custom header/scheme) — distinct cases
# --------------------------------------------------------------------------- #
def test_bearer_standard_unbalanced_entry(providerlab):
    res = partners.call("nimbus-ledger", "post_entry",
                        {"lines": [{"debit": 100}, {"credit": 90}]})
    assert res["status"] == 422
    assert res["error"] == "unbalanced_entry"


def test_bearer_standard_balanced_entry(providerlab):
    res = partners.call("nimbus-ledger", "post_entry",
                        {"lines": [{"debit": 100}, {"credit": 100}]})
    assert res["data"]["posted"] is True


def test_bearer_custom_header_accept(providerlab):
    res = partners.call("vela-mail", "send_message", {"to": "ops@lynx.example", "subject": "hi"})
    assert res["data"]["status"] == "accepted"


def test_bearer_custom_header_invalid_recipient(providerlab):
    res = partners.call("vela-mail", "send_message", {"to": "not-an-email", "subject": "hi"})
    assert res["status"] == 422
    assert res["error"] == "invalid_recipient"


# --------------------------------------------------------------------------- #
# oauth2 client credentials (basic vs post) — distinct cases
# --------------------------------------------------------------------------- #
def test_oauth_cc_basic_convert(providerlab):
    res = partners.call("helios-fx", "convert", {"from": "USD", "to": "EUR", "amount": 1000})
    assert res["data"]["out"] == pytest.approx(920.0)


def test_oauth_cc_post_vendor_not_found(providerlab):
    res = partners.call("orbit-erp", "get_vendor", {"vendorId": "V-9999"})
    assert res["status"] == 404
    assert res["error"] == "vendor_not_found"


def test_oauth_cc_post_create_bill(providerlab):
    res = partners.call("orbit-erp", "create_bill", {"vendorId": "V-1001", "amount": 500})
    assert res["data"]["status"] == "open"


# --------------------------------------------------------------------------- #
# oauth2 authorization code (PKCE vs offline refresh) — distinct cases
# --------------------------------------------------------------------------- #
def test_oauth_ac_pkce_list_accounts(providerlab):
    res = partners.call("corvus-bank", "list_accounts", {})
    assert len(res["data"]["accounts"]) == 2


def test_oauth_ac_pkce_payment_step_up(providerlab):
    res = partners.call("corvus-bank", "initiate_payment",
                        {"fromAccount": "ACC-77", "amount": 2500, "creditor": "ACME"})
    assert res["data"]["status"] == "pending_authorization"


def test_oauth_ac_offline_get_contact(providerlab):
    res = partners.call("lumen-crm", "get_contact", {"contactId": "C-1"})
    assert res["data"]["stage"] == "customer"


# --------------------------------------------------------------------------- #
# none (internal) — distinct cases
# --------------------------------------------------------------------------- #
def test_internal_billing_create_and_404(providerlab):
    made = partners.call("core-billing", "create_invoice", {"customerId": "CUST-1", "amount": 200})
    assert made["data"]["status"] == "open"
    missing = partners.call("core-billing", "get_invoice", {"invoiceId": "inv_does_not_exist"})
    assert missing["status"] == 404


def test_internal_identity_paging(providerlab):
    res = partners.call("core-identity", "list_groups", {"page": 1})
    assert res["data"]["pageSize"] == 10
    assert res["data"]["hasMore"] is True


# --------------------------------------------------------------------------- #
# mcp (bearer) — runs domain over JSON-RPC
# --------------------------------------------------------------------------- #
def test_mcp_bearer_search_catalog(providerlab):
    res = partners.call("forge-mcp", "search_catalog", {"query": "plan"})
    assert any(r["sku"] == "SKU-100" for r in res["data"]["results"])


# --------------------------------------------------------------------------- #
# sdk (api key) — distinct cases
# --------------------------------------------------------------------------- #
def test_sdk_payout_min_amount(providerlab):
    res = partners.call("zephyr-pay", "create_payout",
                        {"amount": 0.5, "currency": "USD", "destination": "acct_1"})
    assert res["status"] == 422
    assert res["error"] == "amount_too_small"


def test_sdk_tax_rate_table(providerlab):
    res = partners.call("terra-tax", "calculate", {"jurisdiction": "US-CA", "amount": 1000})
    assert res["data"]["rate"] == pytest.approx(0.0825)


# --------------------------------------------------------------------------- #
# caracal_mandate providers are gated until the Caracal SDK phase
# --------------------------------------------------------------------------- #
def test_mandate_providers_pending_caracal(providerlab):
    for provider_id in ("atlas-treasury", "sentinel-compliance", "relay-mcp"):
        with pytest.raises(partners.PartnerPendingCaracal):
            partners.call(provider_id, partners.spec(provider_id).operations[0], {})


# --------------------------------------------------------------------------- #
# Agent tool surface uses the partner layer
# --------------------------------------------------------------------------- #
def test_partner_operation_tool_emits_and_runs(providerlab):
    res = tool_fns.partner_operation("run-1", "agent-1", "terra-tax", "calculate",
                                     {"jurisdiction": "US-NY", "amount": 100})
    assert res["data"]["rate"] == pytest.approx(0.08875)


def test_partner_operation_tool_gates_mandate(providerlab):
    res = tool_fns.partner_operation("run-1", "agent-1", "atlas-treasury", "get_position", {})
    assert res["status"] == "pending_caracal_integration"


def test_partner_operation_in_tools_registry():
    assert "partner_operation" in tool_fns.TOOLS
