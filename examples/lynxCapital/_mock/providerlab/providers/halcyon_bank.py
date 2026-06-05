"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Halcyon Bank domain: open-banking accounts, transactions, payment initiation, and statements.
"""
from __future__ import annotations

import time

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "halcyon-bank"

_RAIL_SCHEMES = {
    "ACH": "US.ACH", "RTP": "US.RTP", "WIRE": "SWIFT.WIRE",
    "SEPA": "EU.SEPA.CT", "PAYNOW": "SG.PAYNOW", "PIX": "BR.PIX",
    "NEFT": "IN.NEFT", "RTGS": "IN.RTGS",
}
_TERMINAL = {"AcceptedSettlementCompleted", "Rejected"}


def _iso(epoch: int) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(epoch))


@base.seeder(ID)
def seed(state: base.State) -> None:
    accts = gen.bank_accounts(ID, 6)
    accounts = gen.index_by(accts, key="accountId")
    state.tables["accounts"] = accounts
    txns = gen.bank_transactions(ID, accounts, 400)
    state.tables["transactions"] = gen.index_by(txns, key="transactionId")
    state.tables["statements"] = gen.index_by(
        gen.bank_statements(ID, accounts, txns), key="statementId")
    state.tables["payments"] = {}


@base.op(ID, "list_accounts")
def list_accounts(ctx: Ctx) -> dict:
    ctx.require_scope("accounts.read")
    items = list(ctx.state.table("accounts").values())
    status = ctx.get("status")
    if status:
        items = [a for a in items if a["status"].lower() == str(status).lower()]
    return ctx.paginate(items, size_default=10)


@base.op(ID, "get_account")
def get_account(ctx: Ctx) -> dict:
    ctx.require_scope("accounts.read")
    ctx.require("accountId")
    acct = ctx.state.table("accounts").get(ctx.payload["accountId"])
    if acct is None:
        raise DomainError(404, "account_not_found", ctx.payload["accountId"])
    return acct


@base.op(ID, "list_transactions")
def list_transactions(ctx: Ctx) -> dict:
    ctx.require_scope("accounts.read")
    account_id = ctx.get("accountId")
    if account_id and account_id not in ctx.state.table("accounts"):
        raise DomainError(404, "account_not_found", account_id)
    txns = list(ctx.state.table("transactions").values())
    if account_id:
        txns = [t for t in txns if t["accountId"] == account_id]
    indicator = ctx.get("creditDebitIndicator")
    if indicator:
        txns = [t for t in txns if t["creditDebitIndicator"].lower() == str(indicator).lower()]
    from_date, to_date = ctx.get("fromBookingDateTime"), ctx.get("toBookingDateTime")
    if from_date:
        txns = [t for t in txns if t["bookingDateTime"] >= str(from_date)]
    if to_date:
        txns = [t for t in txns if t["bookingDateTime"] <= str(to_date)]
    txns = sorted(txns, key=lambda t: t["bookingDateTime"], reverse=True)
    return ctx.paginate(txns)


@base.op(ID, "initiate_payment")
def initiate_payment(ctx: Ctx) -> dict:
    ctx.require_scope("payments.write")
    ctx.require("fromAccount", "amount", "creditor")
    acct = ctx.state.table("accounts").get(ctx.payload["fromAccount"])
    if acct is None:
        raise DomainError(404, "account_not_found", ctx.payload["fromAccount"])
    if acct["status"] != "Enabled":
        raise DomainError(409, "account_not_enabled", "debtor account is not enabled for payments")
    try:
        amount = round(float(ctx.payload["amount"]), 2)
    except (TypeError, ValueError):
        raise DomainError(422, "invalid_amount", "amount must be a number")
    if amount <= 0:
        raise DomainError(422, "invalid_amount", "amount must be positive")
    currency = ctx.get("currency", acct["currency"])
    if currency != acct["currency"]:
        raise DomainError(422, "currency_mismatch",
                          f"account currency {acct['currency']} does not match {currency}")
    if amount > acct["balances"]["available"]:
        raise DomainError(402, "insufficient_funds", "amount exceeds available balance")

    idem = ctx.get("idempotencyKey")
    payments = ctx.state.table("payments")
    if idem and idem in payments:
        return payments[idem]

    rail = (ctx.get("rail") or "FasterPayments")
    now = base.now()
    acct["balances"]["available"] = round(acct["balances"]["available"] - amount, 2)
    payment = {
        "paymentId": base.new_id("pmt"),
        "consentId": base.new_id("pcon"),
        "status": "AcceptedSettlementInProgress",
        "paymentType": "DomesticPayment" if str(rail).upper() in ("ACH", "RTP", "FASTERPAYMENTS") else "InternationalPayment",
        "rail": rail,
        "localInstrument": _RAIL_SCHEMES.get(str(rail).upper(), "UK.OBIE.FPS"),
        "debtorAccount": {"accountId": acct["accountId"], "identification": acct["identification"]},
        "creditorAccount": {"name": ctx.payload["creditor"],
                            "identification": ctx.get("creditorAccount", "")},
        "instructedAmount": {"amount": amount, "currency": currency},
        "endToEndIdentification": ctx.get("endToEndId", base.new_id("e2e")),
        "remittanceInformation": ctx.get("reference", ""),
        "charges": [],
        "createdDateTime": _iso(now),
        "statusUpdateDateTime": _iso(now),
        "expectedSettlementDateTime": _iso(now + 86400),
    }
    payments[payment["paymentId"]] = payment
    if idem:
        payments[idem] = payment
    return payment


@base.op(ID, "get_payment")
def get_payment(ctx: Ctx) -> dict:
    ctx.require_scope("payments.write")
    ctx.require("paymentId")
    payment = ctx.state.table("payments").get(ctx.payload["paymentId"])
    if payment is None:
        raise DomainError(404, "payment_not_found", ctx.payload["paymentId"])
    if payment["status"] not in _TERMINAL:
        payment["status"] = "AcceptedSettlementCompleted"
        payment["statusUpdateDateTime"] = _iso(base.now())
    return payment


@base.op(ID, "get_statement")
def get_statement(ctx: Ctx) -> dict:
    ctx.require_scope("accounts.read")
    ctx.require("accountId")
    account_id = ctx.payload["accountId"]
    if account_id not in ctx.state.table("accounts"):
        raise DomainError(404, "account_not_found", account_id)
    statements = sorted(
        (s for s in ctx.state.table("statements").values() if s["accountId"] == account_id),
        key=lambda s: s["endDateTime"], reverse=True)
    statement_id = ctx.get("statementId")
    if statement_id:
        match = next((s for s in statements if s["statementId"] == statement_id), None)
        if match is None:
            raise DomainError(404, "statement_not_found", statement_id)
        return match
    if not statements:
        raise DomainError(404, "statement_not_found", account_id)
    latest = statements[0]
    return {"accountId": account_id, "currency": latest["currency"],
            "latest": latest, "statements": statements}
