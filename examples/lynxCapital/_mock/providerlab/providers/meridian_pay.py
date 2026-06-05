"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Meridian Pay domain: card and wallet charge acceptance, refunds, payouts, balances, and disputes.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "meridian-pay"


@base.seeder(ID)
def seed(state: base.State) -> None:
    state.tables["charges"] = {}
    state.tables["refunds"] = {}
    state.tables["payouts"] = {}
    disputes = {}
    for i in range(1, 9):
        rng = gen._rng(ID, "dispute", i)
        did = f"dp_{i:04d}"
        disputes[did] = {"disputeId": did, "amount": round(rng.uniform(20, 5000), 2),
                         "currency": "USD", "reason": rng.choice(("fraudulent", "duplicate", "product_not_received")),
                         "status": rng.choice(("needs_response", "under_review", "won", "lost"))}
    state.tables["disputes"] = disputes


@base.op(ID, "create_charge")
def create_charge(ctx: Ctx) -> dict:
    ctx.require("amount", "currency", "source")
    amount = float(ctx.payload["amount"])
    if amount <= 0:
        raise DomainError(422, "invalid_amount", "amount must be positive")
    idem = ctx.get("idempotencyKey")
    charges = ctx.state.table("charges")
    if idem and idem in charges:
        return charges[idem]
    status = "requires_action" if amount > 75000 else "succeeded"
    charge = {"chargeId": base.new_id("ch"), "status": status, "amount": amount,
              "currency": ctx.payload["currency"], "source": ctx.payload["source"],
              "refunded": 0.0, "createdAt": base.now()}
    charges[charge["chargeId"]] = charge
    if idem:
        charges[idem] = charge
    return charge


@base.op(ID, "get_charge")
def get_charge(ctx: Ctx) -> dict:
    ctx.require("chargeId")
    charge = ctx.state.table("charges").get(ctx.payload["chargeId"])
    if charge is None:
        raise DomainError(404, "charge_not_found", ctx.payload["chargeId"])
    return charge


@base.op(ID, "refund_charge")
def refund_charge(ctx: Ctx) -> dict:
    ctx.require("chargeId")
    charge = ctx.state.table("charges").get(ctx.payload["chargeId"])
    if charge is None:
        raise DomainError(404, "charge_not_found", ctx.payload["chargeId"])
    amount = float(ctx.get("amount", charge["amount"] - charge["refunded"]))
    if amount <= 0 or charge["refunded"] + amount > charge["amount"] + 1e-6:
        raise DomainError(422, "refund_exceeds_charge", "refund amount exceeds remaining balance")
    charge["refunded"] = round(charge["refunded"] + amount, 2)
    if charge["refunded"] >= charge["amount"]:
        charge["status"] = "refunded"
    refund = {"refundId": base.new_id("re"), "chargeId": charge["chargeId"],
              "amount": amount, "status": "succeeded"}
    ctx.state.table("refunds")[refund["refundId"]] = refund
    return refund


@base.op(ID, "create_payout")
def create_payout(ctx: Ctx) -> dict:
    ctx.require("amount", "currency", "destination")
    amount = float(ctx.payload["amount"])
    if amount < 1.0:
        raise DomainError(422, "amount_too_small", "minimum payout is 1.00")
    payout = {"payoutId": base.new_id("po"), "status": "in_transit", "amount": amount,
              "currency": ctx.payload["currency"], "destination": ctx.payload["destination"]}
    ctx.state.table("payouts")[payout["payoutId"]] = payout
    return payout


@base.op(ID, "get_balance")
def get_balance(ctx: Ctx) -> dict:
    charges = ctx.state.table("charges")
    gross = round(sum(c["amount"] for c in charges.values() if isinstance(c.get("amount"), (int, float))
                      and c.get("status") in ("succeeded", "refunded")), 2)
    return {"available": round(184230.55 + gross, 2), "pending": 9120.00, "currency": "USD"}


@base.op(ID, "list_disputes")
def list_disputes(ctx: Ctx) -> dict:
    items = list(ctx.state.table("disputes").values())
    status = ctx.get("status")
    if status:
        items = [d for d in items if d["status"] == status]
    return ctx.paginate(items, size_default=10)
