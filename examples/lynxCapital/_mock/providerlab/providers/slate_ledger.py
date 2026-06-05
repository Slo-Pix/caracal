"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Slate Ledger domain: double-entry journal posting, account balances, reconciliation, accruals, and period close.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "slate-ledger"


@base.seeder(ID)
def seed(state: base.State) -> None:
    accts = gen.accounts(ID, 16)
    state.tables["accounts"] = gen.index_by(accts)
    state.tables["entries"] = {}
    state.tables["periods"] = {
        "2026-01": {"period": "2026-01", "status": "open"},
        "2026-02": {"period": "2026-02", "status": "open"},
    }
    state.tables["reconciliations"] = {}


@base.op(ID, "post_entry")
def post_entry(ctx: Ctx) -> dict:
    lines = ctx.get("lines") or []
    if len(lines) < 2:
        raise DomainError(422, "unbalanced", "entry requires at least two lines")
    debit = round(sum(float(l.get("debit", 0)) for l in lines), 2)
    credit = round(sum(float(l.get("credit", 0)) for l in lines), 2)
    if debit != credit:
        raise DomainError(422, "unbalanced", f"debit {debit} != credit {credit}")
    period = ctx.get("period", "2026-02")
    pr = ctx.state.table("periods").get(period)
    if pr and pr["status"] == "closed":
        raise DomainError(409, "period_closed", f"period {period} is closed")
    entry = {"entryId": base.new_id("ent"), "period": period, "debit": debit,
             "credit": credit, "lines": lines, "status": "posted"}
    ctx.state.table("entries")[entry["entryId"]] = entry
    return entry


@base.op(ID, "get_entry")
def get_entry(ctx: Ctx) -> dict:
    ctx.require("entryId")
    entry = ctx.state.table("entries").get(ctx.payload["entryId"])
    if entry is None:
        raise DomainError(404, "entry_not_found", ctx.payload["entryId"])
    return entry


@base.op(ID, "get_account")
def get_account(ctx: Ctx) -> dict:
    ctx.require("accountId")
    acct = ctx.state.table("accounts").get(ctx.payload["accountId"])
    if acct is None:
        raise DomainError(404, "account_not_found", ctx.payload["accountId"])
    return acct


@base.op(ID, "reconcile_account")
def reconcile_account(ctx: Ctx) -> dict:
    ctx.require("accountId", "statementBalance")
    acct = ctx.state.table("accounts").get(ctx.payload["accountId"])
    if acct is None:
        raise DomainError(404, "account_not_found", ctx.payload["accountId"])
    diff = round(float(ctx.payload["statementBalance"]) - acct["balance"], 2)
    rec = {"reconciliationId": base.new_id("rec"), "accountId": acct["id"],
           "difference": diff, "status": "balanced" if abs(diff) < 0.01 else "exception"}
    ctx.state.table("reconciliations")[rec["reconciliationId"]] = rec
    return rec


@base.op(ID, "compute_accrual")
def compute_accrual(ctx: Ctx) -> dict:
    ctx.require("amount", "periods")
    amount = float(ctx.payload["amount"])
    periods = int(ctx.payload["periods"])
    if periods <= 0:
        raise DomainError(422, "invalid_periods", "periods must be positive")
    return {"accrualId": base.new_id("acr"), "perPeriod": round(amount / periods, 2),
            "amount": amount, "periods": periods}


@base.op(ID, "close_period")
def close_period(ctx: Ctx) -> dict:
    ctx.require("period")
    pr = ctx.state.table("periods").get(ctx.payload["period"])
    if pr is None:
        raise DomainError(404, "period_not_found", ctx.payload["period"])
    if pr["status"] == "closed":
        raise DomainError(409, "already_closed", "period already closed")
    pr["status"] = "closed"
    pr["closedAt"] = base.now()
    return pr


@base.op(ID, "get_period")
def get_period(ctx: Ctx) -> dict:
    ctx.require("period")
    pr = ctx.state.table("periods").get(ctx.payload["period"])
    if pr is None:
        raise DomainError(404, "period_not_found", ctx.payload["period"])
    return pr
