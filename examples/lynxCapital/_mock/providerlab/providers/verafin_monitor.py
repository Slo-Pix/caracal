"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Verafin Monitor domain: transaction monitoring, alert triage, asynchronous regulatory filing, and control attestation.
"""
from __future__ import annotations

from _mock.providerlab import intelligence
from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "verafin-monitor"

_TYPOLOGIES = ("structuring", "rapid_movement", "high_risk_geo", "round_amount", "velocity")


@base.seeder(ID)
def seed(state: base.State) -> None:
    state.tables["alerts"] = {}
    state.tables["filings"] = {}
    state.tables["attestations"] = {}


@base.op(ID, "monitor_transaction")
def monitor_transaction(ctx: Ctx) -> dict:
    ctx.require_scope("monitoring.run")
    ctx.require("transactionId", "amount")
    amount = float(ctx.payload["amount"])
    rng = gen._rng(ID, "score", ctx.payload["transactionId"])
    score = round(min(1.0, amount / 250_000 * rng.uniform(0.6, 1.4)), 2)
    result = {"transactionId": ctx.payload["transactionId"], "riskScore": score,
              "flagged": score >= 0.7}
    if result["flagged"]:
        alert = {"alertId": base.new_id("alt"), "transactionId": ctx.payload["transactionId"],
                 "typology": rng.choice(_TYPOLOGIES), "riskScore": score, "status": "open"}
        ctx.state.table("alerts")[alert["alertId"]] = alert
        result["alertId"] = alert["alertId"]
    return result


@base.op(ID, "get_alert")
def get_alert(ctx: Ctx) -> dict:
    ctx.require_scope("monitoring.run")
    ctx.require("alertId")
    alert = ctx.state.table("alerts").get(ctx.payload["alertId"])
    if alert is None:
        raise DomainError(404, "alert_not_found", ctx.payload["alertId"])
    return alert


@base.op(ID, "prepare_filing")
def prepare_filing(ctx: Ctx) -> dict:
    """Assemble a regulatory filing (SAR/CTR); narrative drafting runs asynchronously."""
    ctx.require_scope("filings.write")
    ctx.require("alertId", "filingType")
    alert = ctx.state.table("alerts").get(ctx.payload["alertId"])
    if alert is None:
        raise DomainError(404, "alert_not_found", ctx.payload["alertId"])
    if ctx.payload["filingType"] not in ("SAR", "CTR"):
        raise DomainError(422, "invalid_filing_type", "filingType must be SAR or CTR")
    filing = {"filingId": base.new_id("fil"), "alertId": alert["alertId"],
              "filingType": ctx.payload["filingType"], "status": "drafting"}
    ctx.state.table("filings")[filing["filingId"]] = filing
    return filing


@base.op(ID, "get_filing")
def get_filing(ctx: Ctx) -> dict:
    ctx.require_scope("filings.write")
    ctx.require("filingId")
    filing = ctx.state.table("filings").get(ctx.payload["filingId"])
    if filing is None:
        raise DomainError(404, "filing_not_found", ctx.payload["filingId"])
    if filing["status"] == "drafting":
        filing["status"] = "ready"
        filing["narrative"] = intelligence.narrative(
            "You are an AML investigator drafting a suspicious activity narrative.",
            f"Draft a one-sentence SAR narrative for alert {filing['alertId']}.",
            f"Filing {filing['filingId']} documents suspicious activity tied to alert {filing['alertId']}.")
    return filing


@base.op(ID, "attest_control")
def attest_control(ctx: Ctx) -> dict:
    ctx.require_scope("filings.write")
    ctx.require("controlId", "attestor")
    att = {"attestationId": base.new_id("att"), "controlId": ctx.payload["controlId"],
           "attestor": ctx.payload["attestor"], "status": "attested", "at": base.now()}
    ctx.state.table("attestations")[att["attestationId"]] = att
    return att
