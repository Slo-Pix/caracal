"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Quetzal Payouts domain: global recipient onboarding, FX-aware payout quotes, single payouts, and batch disbursement.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "quetzal-payouts"

_RATES = {"USD": 1.0, "EUR": 0.92, "GBP": 0.79, "JPY": 156.4, "BRL": 5.08, "SGD": 1.35, "CAD": 1.36}


@base.seeder(ID)
def seed(state: base.State) -> None:
    recs = gen.recipients(ID, 400)
    state.tables["recipients"] = gen.index_by(recs)
    state.tables["payouts"] = {}
    state.tables["batches"] = {}


@base.op(ID, "create_recipient")
def create_recipient(ctx: Ctx) -> dict:
    ctx.require("name", "currency", "method")
    if ctx.payload["currency"] not in _RATES:
        raise DomainError(422, "unsupported_currency", ctx.payload["currency"])
    recipients = ctx.state.table("recipients")
    rid = f"RCPT-{len(recipients) + 1:05d}"
    rec = {"id": rid, "name": ctx.payload["name"], "currency": ctx.payload["currency"],
           "method": ctx.payload["method"], "verified": False, "country": ctx.get("country", "US")}
    recipients[rid] = rec
    return rec


@base.op(ID, "get_quote")
def get_quote(ctx: Ctx) -> dict:
    ctx.require("amount", "sourceCurrency", "targetCurrency")
    src = _RATES.get(ctx.payload["sourceCurrency"])
    tgt = _RATES.get(ctx.payload["targetCurrency"])
    if src is None or tgt is None:
        raise DomainError(422, "unsupported_currency", "currency not supported")
    amount = float(ctx.payload["amount"])
    rate = round(tgt / src, 6)
    return {"quoteId": base.new_id("q"), "rate": rate, "sends": amount,
            "receives": round(amount * rate, 2), "fee": round(amount * 0.01, 2)}


@base.op(ID, "create_payout")
def create_payout(ctx: Ctx) -> dict:
    ctx.require("recipientId", "amount", "currency")
    rec = ctx.state.table("recipients").get(ctx.payload["recipientId"])
    if rec is None:
        raise DomainError(404, "recipient_not_found", ctx.payload["recipientId"])
    if not rec["verified"]:
        raise DomainError(403, "recipient_unverified", "recipient must be verified before payout")
    payout = {"payoutId": base.new_id("po"), "recipientId": rec["id"],
              "amount": float(ctx.payload["amount"]), "currency": ctx.payload["currency"],
              "status": "processing"}
    ctx.state.table("payouts")[payout["payoutId"]] = payout
    return payout


@base.op(ID, "create_batch")
def create_batch(ctx: Ctx) -> dict:
    items = ctx.get("items") or []
    if not items:
        raise DomainError(422, "empty_batch", "batch requires at least one item")
    recipients = ctx.state.table("recipients")
    accepted, rejected = [], []
    for item in items:
        rec = recipients.get(item.get("recipientId"))
        if rec is None:
            rejected.append({"recipientId": item.get("recipientId"), "reason": "recipient_not_found"})
        elif not rec["verified"]:
            rejected.append({"recipientId": item.get("recipientId"), "reason": "recipient_unverified"})
        else:
            accepted.append({"recipientId": rec["id"], "amount": item.get("amount")})
    batch = {"batchId": base.new_id("bat"), "status": "partially_completed" if rejected else "completed",
             "accepted": accepted, "rejected": rejected, "total": len(items)}
    ctx.state.table("batches")[batch["batchId"]] = batch
    return batch


@base.op(ID, "get_batch")
def get_batch(ctx: Ctx) -> dict:
    ctx.require("batchId")
    batch = ctx.state.table("batches").get(ctx.payload["batchId"])
    if batch is None:
        raise DomainError(404, "batch_not_found", ctx.payload["batchId"])
    return batch
