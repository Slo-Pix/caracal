"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Validates the application partner integration layer authenticating to every external provider category over its real network surface.
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
def test_partner_catalog_covers_twenty():
    assert len(partners.catalog()) == 20


def test_partner_catalog_auth_kinds():
    auths = {s.auth for s in partners.catalog().values()}
    assert auths == {"api_key", "bearer", "oauth_cc", "oauth_ac", "none", "mcp_bearer", "mandate"}


# --------------------------------------------------------------------------- #
# api_key (header vs query) — distinct cases
# --------------------------------------------------------------------------- #
def test_api_key_header_charge_idempotent(providerlab):
    first = partners.call("meridian-pay", "create_charge",
                          {"amount": 1200, "currency": "USD", "source": "tok_visa", "idempotencyKey": "idem-1"})
    assert first["data"]["status"] == "succeeded"
    again = partners.call("meridian-pay", "create_charge",
                          {"amount": 1200, "currency": "USD", "source": "tok_visa", "idempotencyKey": "idem-1"})
    assert again["data"]["chargeId"] == first["data"]["chargeId"]


def test_api_key_header_invalid_amount(providerlab):
    res = partners.call("meridian-pay", "create_charge",
                        {"amount": -1, "currency": "USD", "source": "tok_visa"})
    assert res["status"] == 422
    assert res["error"] == "invalid_amount"


def test_api_key_query_async_job(providerlab):
    doc = partners.call("inkwell-ocr", "submit_document", {"fileName": "inv.pdf"})
    assert doc["data"]["status"] == "processing"
    done = partners.call("inkwell-ocr", "get_extraction", {"documentId": doc["data"]["documentId"]})
    assert done["data"]["status"] == "extracted"


def test_api_key_missing_credential_raises(providerlab):
    saved = os.environ.pop("LYNX_PARTNER_MERIDIAN_PAY_API_KEY")
    try:
        with pytest.raises(partners.PartnerError):
            partners.call("meridian-pay", "get_balance", {})
    finally:
        os.environ["LYNX_PARTNER_MERIDIAN_PAY_API_KEY"] = saved


# --------------------------------------------------------------------------- #
# bearer (standard vs custom header/scheme) — distinct cases
# --------------------------------------------------------------------------- #
def test_bearer_standard_unbalanced_entry(providerlab):
    res = partners.call("slate-ledger", "post_entry", {"lines": [{"debit": 100}, {"credit": 90}]})
    assert res["status"] == 422
    assert res["error"] == "unbalanced"


def test_bearer_standard_balanced_entry(providerlab):
    res = partners.call("slate-ledger", "post_entry", {"lines": [{"debit": 100}, {"credit": 100}]})
    assert res["data"]["status"] == "posted"


def test_bearer_custom_header_accept(providerlab):
    res = partners.call("vela-notify", "send_message",
                        {"channel": "email", "to": "ops@lynx.example", "template": "remittance_advice"})
    assert res["data"]["status"] == "queued"


def test_bearer_custom_header_invalid_channel(providerlab):
    res = partners.call("vela-notify", "send_message",
                        {"channel": "fax", "to": "ops@lynx.example", "template": "remittance_advice"})
    assert res["status"] == 422
    assert res["error"] == "invalid_channel"


# --------------------------------------------------------------------------- #
# oauth2 client credentials (basic vs post) — distinct cases
# --------------------------------------------------------------------------- #
def test_oauth_cc_basic_convert(providerlab):
    res = partners.call("cordoba-fx", "create_conversion",
                        {"buy_currency": "EUR", "sell_currency": "USD", "amount": 1000,
                         "fixed_side": "sell", "term_agreement": True})
    assert res["status"] == 200
    assert res["data"]["status"] == "awaiting_funds"
    assert "client_buy_amount" in res["data"] and res["data"]["currency_pair"] == "EURUSD"


def test_oauth_cc_post_vendor_not_found(providerlab):
    res = partners.call("ironbark-erp", "get_vendor", {"vendorId": "V-DOES-NOT-EXIST"})
    assert res["status"] == 404


def test_oauth_cc_requisition_budget_flow(providerlab):
    made = partners.call("junction-procure", "create_requisition",
                         {"department": "engineering", "amount": 5000, "description": "laptops"})
    assert made["data"]["status"] in ("approved", "pending_approval")
    missing = partners.call("junction-procure", "create_requisition",
                            {"department": "nowhere", "amount": 100, "description": "x"})
    assert missing["status"] == 404


# --------------------------------------------------------------------------- #
# oauth2 authorization code (PKCE vs offline refresh) — distinct cases
# --------------------------------------------------------------------------- #
def test_oauth_ac_pkce_list_accounts(providerlab):
    res = partners.call("halcyon-bank", "list_accounts", {})
    assert res["status"] == 200 and res["data"]["items"]


def test_oauth_ac_pkce_initiate_payment(providerlab):
    acct = partners.call("halcyon-bank", "list_accounts", {})["data"]["items"][0]["accountId"]
    res = partners.call("halcyon-bank", "initiate_payment",
                        {"fromAccount": acct, "amount": 10, "creditor": "ACME"})
    assert res["status"] == 200


def test_oauth_ac_offline_tallyhall_vendors(providerlab):
    res = partners.call("tallyhall-books", "list_vendors", {})
    assert res["status"] == 200 and "items" in res["data"]


# --------------------------------------------------------------------------- #
# none (internal) — distinct cases
# --------------------------------------------------------------------------- #
def test_internal_billing_create_and_404(providerlab):
    aging = partners.call("core-billing", "get_ar_aging", {})
    assert aging["status"] == 200
    missing = partners.call("core-billing", "get_invoice", {"invoiceId": "inv_does_not_exist"})
    assert missing["status"] == 404


def test_internal_identity_paging(providerlab):
    res = partners.call("lumen-identity", "list_users", {"page": 1, "pageSize": 10})
    assert res["data"]["page"] == 1
    assert len(res["data"]["items"]) <= 10


# --------------------------------------------------------------------------- #
# mcp (bearer) — runs domain over JSON-RPC
# --------------------------------------------------------------------------- #
def test_mcp_bearer_search_vendors(providerlab):
    res = partners.call("atlas-vendor", "search_vendors", {"query": "a"})
    assert res["status"] == 200 and "items" in res["data"]


# --------------------------------------------------------------------------- #
# sdk (api key over REST) — distinct cases
# --------------------------------------------------------------------------- #
def test_sdk_tax_rate_table(providerlab):
    res = partners.call("sabre-tax", "calculate", {"jurisdiction": "US-CA", "amount": 1000})
    assert res["data"]["rate"] == pytest.approx(0.0825)


def test_sdk_payout_unverified_recipient(providerlab):
    rec = partners.call("quetzal-payouts", "create_recipient",
                        {"name": "R", "currency": "USD", "method": "bank"})
    res = partners.call("quetzal-payouts", "create_payout",
                        {"recipientId": rec["data"]["id"], "amount": 100, "currency": "USD"})
    assert res["status"] in (200, 403)


# --------------------------------------------------------------------------- #
# caracal_mandate providers are gated until the Caracal SDK phase
# --------------------------------------------------------------------------- #
def test_mandate_providers_pending_caracal(providerlab):
    for provider_id in ("aegis-screening", "verafin-monitor", "relay-automation"):
        with pytest.raises(partners.PartnerPendingCaracal):
            partners.call(provider_id, partners.spec(provider_id).operations[0], {})


# --------------------------------------------------------------------------- #
# Agent tool surface uses the partner layer
# --------------------------------------------------------------------------- #
def test_partner_operation_tool_emits_and_runs(providerlab):
    res = tool_fns.partner_operation("run-1", "agent-1", "sabre-tax", "calculate",
                                     {"jurisdiction": "US-NY", "amount": 100})
    assert res["data"]["rate"] == pytest.approx(0.08875)


def test_partner_operation_tool_gates_mandate(providerlab):
    res = tool_fns.partner_operation("run-1", "agent-1", "aegis-screening", "screen_party", {"name": "x"})
    assert res["status"] == "pending_caracal_integration"


def test_partner_operation_in_tools_registry():
    assert "partner_operation" in tool_fns.TOOLS
