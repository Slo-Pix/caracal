"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Keystone Treasury domain: cash position reporting, liquidity forecasting, hedge placement, and internal transfers.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "keystone-treasury"


@base.seeder(ID)
def seed(state: base.State) -> None:
    positions = {}
    for cur in ("USD", "EUR", "GBP", "JPY", "SGD", "BRL"):
        rng = gen._rng(ID, "pos", cur)
        positions[cur] = {"currency": cur, "cash": round(rng.uniform(500_000, 40_000_000), 2),
                          "available": 0.0, "asOf": gen._day(rng, -1, 0)}
        positions[cur]["available"] = round(positions[cur]["cash"] * rng.uniform(0.7, 0.97), 2)
    state.tables["positions"] = positions
    state.tables["hedges"] = {}
    state.tables["transfers"] = {}


@base.op(ID, "get_position")
def get_position(ctx: Ctx) -> dict:
    ctx.require("currency")
    pos = ctx.state.table("positions").get(ctx.payload["currency"])
    if pos is None:
        raise DomainError(404, "position_not_found", ctx.payload["currency"])
    return pos


@base.op(ID, "forecast_liquidity")
def forecast_liquidity(ctx: Ctx) -> dict:
    ctx.require("currency", "horizonDays")
    pos = ctx.state.table("positions").get(ctx.payload["currency"])
    if pos is None:
        raise DomainError(404, "position_not_found", ctx.payload["currency"])
    horizon = int(ctx.payload["horizonDays"])
    if horizon <= 0 or horizon > 365:
        raise DomainError(422, "invalid_horizon", "horizonDays must be 1..365")
    points = []
    balance = pos["available"]
    for d in range(0, horizon, max(1, horizon // 6)):
        rng = gen._rng(ID, "fc", ctx.payload["currency"], d)
        balance = round(balance + rng.uniform(-250_000, 300_000), 2)
        points.append({"day": d, "projected": balance})
    return {"currency": ctx.payload["currency"], "horizonDays": horizon, "points": points}


@base.op(ID, "place_hedge")
def place_hedge(ctx: Ctx) -> dict:
    ctx.require("pair", "notional", "side")
    if ctx.payload["side"] not in ("buy", "sell"):
        raise DomainError(422, "invalid_side", "side must be buy or sell")
    hedge = {"hedgeId": base.new_id("hdg"), "pair": ctx.payload["pair"],
             "notional": float(ctx.payload["notional"]), "side": ctx.payload["side"],
             "status": "booked"}
    ctx.state.table("hedges")[hedge["hedgeId"]] = hedge
    return hedge


@base.op(ID, "transfer_funds")
def transfer_funds(ctx: Ctx) -> dict:
    ctx.require("currency", "amount", "destination")
    pos = ctx.state.table("positions").get(ctx.payload["currency"])
    if pos is None:
        raise DomainError(404, "position_not_found", ctx.payload["currency"])
    amount = float(ctx.payload["amount"])
    if amount > pos["available"]:
        raise DomainError(402, "insufficient_liquidity", "amount exceeds available cash")
    pos["available"] = round(pos["available"] - amount, 2)
    transfer = {"transferId": base.new_id("tr"), "currency": ctx.payload["currency"],
                "amount": amount, "destination": ctx.payload["destination"], "status": "executed"}
    ctx.state.table("transfers")[transfer["transferId"]] = transfer
    return transfer
