"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Slate Ledger domain: double-entry journal posting, chart of accounts, statement reconciliation, recurring accruals, trial balance, and fiscal-period close.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "slate-ledger"


@base.seeder(ID)
def seed(state: base.State) -> None:
    for name, table in gen.slate_dataset(ID).items():
        state.tables[name] = table


def _account(ctx: Ctx, account_no: str) -> dict:
    accounts = ctx.state.table("accounts")
    acct = accounts.get(str(account_no)) or accounts.get(str(account_no).removeprefix("ACCT-"))
    if acct is None:
        raise DomainError(404, "account_not_found", str(account_no))
    return acct


def _open_periods(ctx: Ctx) -> list[str]:
    return sorted(p for p, row in ctx.state.table("periods").items() if row["status"] == "open")


def _apply_balance(acct: dict, debit: float, credit: float) -> None:
    delta = (debit - credit) if acct["normalBalance"] == "debit" else (credit - debit)
    acct["balance"] = round(acct["balance"] + delta, 2)


# --------------------------------------------------------------------------- #
# Chart of accounts
# --------------------------------------------------------------------------- #
@base.op(ID, "list_accounts")
def list_accounts(ctx: Ctx) -> dict:
    items = list(ctx.state.table("accounts").values())
    acct_type = ctx.get("type")
    if acct_type:
        items = [a for a in items if a["type"] == acct_type]
    status = ctx.get("status")
    if status:
        items = [a for a in items if a["status"] == status]
    items.sort(key=lambda a: a["accountNo"])
    return ctx.paginate(items, size_default=25)


@base.op(ID, "get_account")
def get_account(ctx: Ctx) -> dict:
    ctx.require("accountId")
    return _account(ctx, ctx.payload["accountId"])


# --------------------------------------------------------------------------- #
# Journal entries (double-entry)
# --------------------------------------------------------------------------- #
@base.op(ID, "post_entry")
def post_entry(ctx: Ctx) -> dict:
    lines = ctx.get("lines") or []
    if len(lines) < 2:
        raise DomainError(422, "unbalanced", "entry requires at least two lines")
    accounts = ctx.state.table("accounts")
    debit = round(sum(float(l.get("debit", 0) or 0) for l in lines), 2)
    credit = round(sum(float(l.get("credit", 0) or 0) for l in lines), 2)
    if debit != credit:
        raise DomainError(422, "unbalanced", f"debit {debit} != credit {credit}")
    if debit == 0:
        raise DomainError(422, "zero_value", "entry total must be non-zero")

    period = ctx.get("period") or (_open_periods(ctx)[0] if _open_periods(ctx) else None)
    pr = ctx.state.table("periods").get(period)
    if pr is None:
        raise DomainError(404, "period_not_found", str(period))
    if pr["status"] != "open":
        raise DomainError(409, "period_closed", f"period {period} is {pr['status']}")

    normalized = []
    for n, line in enumerate(lines, start=1):
        account_no = str(line.get("accountNo") or line.get("account") or "")
        acct = None
        if account_no:
            acct = accounts.get(account_no) or accounts.get(account_no.removeprefix("ACCT-"))
            if acct is None:
                raise DomainError(422, "invalid_account", f"account {account_no} is not in the chart")
        d = round(float(line.get("debit", 0) or 0), 2)
        c = round(float(line.get("credit", 0) or 0), 2)
        normalized.append({
            "lineNo": n, "accountNo": acct["accountNo"] if acct else account_no,
            "accountName": acct["name"] if acct else None,
            "debit": d, "credit": c,
            "department": line.get("department"), "memo": line.get("memo", ""),
        })

    seq = len([e for e in ctx.state.table("entries") if e.startswith(f"JE-{period.replace('-', '')}")]) + 1
    journal_id = f"JE-{period.replace('-', '')}-{seq:04d}"
    entry = {
        "journalId": journal_id,
        "entryNo": base.new_id("gl"),
        "type": ctx.get("type", "standard"),
        "source": ctx.get("source", "manual"),
        "period": period,
        "currency": ctx.get("currency", "USD"),
        "description": ctx.get("description", "Manual journal entry"),
        "reference": ctx.get("reference"),
        "lines": normalized,
        "totalDebit": debit,
        "totalCredit": credit,
        "status": "posted",
        "reversalOf": None,
        "reversedBy": None,
        "postedBy": "api-token@slate-ledger.test",
        "postedAt": base.now(),
    }
    for line in normalized:
        if line["accountName"] is not None:
            _apply_balance(accounts[line["accountNo"]], line["debit"], line["credit"])
    ctx.state.table("entries")[journal_id] = entry
    return entry


@base.op(ID, "get_entry")
def get_entry(ctx: Ctx) -> dict:
    ctx.require("entryId")
    entry = ctx.state.table("entries").get(ctx.payload["entryId"])
    if entry is None:
        raise DomainError(404, "entry_not_found", ctx.payload["entryId"])
    return entry


@base.op(ID, "list_entries")
def list_entries(ctx: Ctx) -> dict:
    items = list(ctx.state.table("entries").values())
    period = ctx.get("period")
    if period:
        items = [e for e in items if e["period"] == period]
    entry_type = ctx.get("type")
    if entry_type:
        items = [e for e in items if e["type"] == entry_type]
    items.sort(key=lambda e: e["journalId"], reverse=True)
    return ctx.paginate(items, size_default=20)


@base.op(ID, "reverse_entry")
def reverse_entry(ctx: Ctx) -> dict:
    ctx.require("entryId")
    entries = ctx.state.table("entries")
    original = entries.get(ctx.payload["entryId"])
    if original is None:
        raise DomainError(404, "entry_not_found", ctx.payload["entryId"])
    if original["reversedBy"]:
        raise DomainError(409, "already_reversed",
                          f"entry {original['journalId']} was reversed by {original['reversedBy']}")
    period = ctx.get("period") or original["period"]
    pr = ctx.state.table("periods").get(period)
    if pr is None or pr["status"] != "open":
        raise DomainError(409, "period_closed", f"cannot post a reversal into period {period}")

    accounts = ctx.state.table("accounts")
    swapped = []
    for line in original["lines"]:
        d, c = line["credit"], line["debit"]
        swapped.append({**line, "debit": d, "credit": c})
        if line["accountName"] is not None:
            _apply_balance(accounts[line["accountNo"]], d, c)
    seq = len(entries) + 1
    journal_id = f"JE-{period.replace('-', '')}-R{seq:04d}"
    reversal = {
        "journalId": journal_id,
        "entryNo": base.new_id("gl"),
        "type": "reversal",
        "source": "manual",
        "period": period,
        "currency": original["currency"],
        "description": f"Reversal of {original['journalId']}",
        "reference": original.get("reference"),
        "lines": swapped,
        "totalDebit": original["totalCredit"],
        "totalCredit": original["totalDebit"],
        "status": "posted",
        "reversalOf": original["journalId"],
        "reversedBy": None,
        "postedBy": "api-token@slate-ledger.test",
        "postedAt": base.now(),
    }
    entries[journal_id] = reversal
    original["reversedBy"] = journal_id
    return reversal


# --------------------------------------------------------------------------- #
# Reconciliation — asynchronous statement match
# --------------------------------------------------------------------------- #
@base.op(ID, "reconcile_account")
def reconcile_account(ctx: Ctx) -> dict:
    """Open a reconciliation job that matches a bank or sub-ledger statement
    against the GL balance. The job is created here and settled by a follow-up
    call to get_reconciliation, the way a close platform queues matching."""
    ctx.require("accountId")
    acct = _account(ctx, ctx.payload["accountId"])
    gl_balance = acct["balance"]
    statement_balance = round(float(ctx.get("statementBalance", gl_balance)), 2)
    period = ctx.get("period") or (_open_periods(ctx)[0] if _open_periods(ctx) else None)
    rid = base.new_id("rec")
    rec = {
        "reconciliationId": rid,
        "accountNo": acct["accountNo"],
        "accountName": acct["name"],
        "period": period,
        "glBalance": gl_balance,
        "statementBalance": statement_balance,
        "outstandingItems": ctx.get("outstandingItems", []),
        "status": "in_progress",
        "jobId": base.new_id("job"),
        "preparedBy": "api-token@slate-ledger.test",
        "submittedAt": base.now(),
    }
    ctx.state.table("reconciliations")[rid] = rec
    return rec


@base.op(ID, "get_reconciliation")
def get_reconciliation(ctx: Ctx) -> dict:
    ctx.require("reconciliationId")
    rec = ctx.state.table("reconciliations").get(ctx.payload["reconciliationId"])
    if rec is None:
        raise DomainError(404, "reconciliation_not_found", ctx.payload["reconciliationId"])
    if rec["status"] == "in_progress":
        outstanding_total = round(sum(float(i.get("amount", 0)) for i in rec["outstandingItems"]), 2)
        rec["outstandingTotal"] = outstanding_total
        rec["adjustedBalance"] = round(rec["statementBalance"] - outstanding_total, 2)
        rec["difference"] = round(rec["adjustedBalance"] - rec["glBalance"], 2)
        rec["status"] = "balanced" if abs(rec["difference"]) < 0.01 else "exception"
        rec["reconciledAt"] = base.now()
    return rec


# --------------------------------------------------------------------------- #
# Recurring accruals
# --------------------------------------------------------------------------- #
@base.op(ID, "create_accrual")
def create_accrual(ctx: Ctx) -> dict:
    ctx.require("amount", "periods")
    amount = round(float(ctx.payload["amount"]), 2)
    periods = int(ctx.payload["periods"])
    if periods <= 0:
        raise DomainError(422, "invalid_periods", "periods must be positive")
    if amount <= 0:
        raise DomainError(422, "invalid_amount", "amount must be positive")
    accrual = {
        "accrualId": base.new_id("acr"),
        "description": ctx.get("description", ctx.get("category", "Accrued expense")),
        "expenseAccount": ctx.get("expenseAccount", "6300"),
        "liabilityAccount": ctx.get("liabilityAccount", "2100"),
        "totalAmount": amount,
        "periods": periods,
        "perPeriod": round(amount / periods, 2),
        "postedPeriods": 0,
        "currency": ctx.get("currency", "USD"),
        "status": "active",
        "createdAt": base.now(),
    }
    ctx.state.table("accruals")[accrual["accrualId"]] = accrual
    return accrual


# --------------------------------------------------------------------------- #
# Trial balance and period close
# --------------------------------------------------------------------------- #
def _trial_balance(ctx: Ctx, period: str | None) -> dict:
    totals: dict[str, dict] = {}
    for entry in ctx.state.table("entries").values():
        if period and entry["period"] != period:
            continue
        for line in entry["lines"]:
            if line["accountName"] is None:
                continue
            row = totals.setdefault(line["accountNo"], {
                "accountNo": line["accountNo"], "accountName": line["accountName"],
                "debit": 0.0, "credit": 0.0,
            })
            row["debit"] = round(row["debit"] + line["debit"], 2)
            row["credit"] = round(row["credit"] + line["credit"], 2)
    rows = sorted(totals.values(), key=lambda r: r["accountNo"])
    total_debit = round(sum(r["debit"] for r in rows), 2)
    total_credit = round(sum(r["credit"] for r in rows), 2)
    return {
        "period": period,
        "rows": rows,
        "totalDebit": total_debit,
        "totalCredit": total_credit,
        "balanced": abs(total_debit - total_credit) < 0.01,
    }


@base.op(ID, "trial_balance")
def trial_balance(ctx: Ctx) -> dict:
    return _trial_balance(ctx, ctx.get("period"))


@base.op(ID, "list_periods")
def list_periods(ctx: Ctx) -> dict:
    items = sorted(ctx.state.table("periods").values(), key=lambda p: p["periodId"])
    status = ctx.get("status")
    if status:
        items = [p for p in items if p["status"] == status]
    return {"items": items, "total": len(items)}


@base.op(ID, "get_period")
def get_period(ctx: Ctx) -> dict:
    ctx.require("period")
    pr = ctx.state.table("periods").get(ctx.payload["period"])
    if pr is None:
        raise DomainError(404, "period_not_found", ctx.payload["period"])
    return pr


@base.op(ID, "close_period")
def close_period(ctx: Ctx) -> dict:
    ctx.require("period")
    period = ctx.payload["period"]
    pr = ctx.state.table("periods").get(period)
    if pr is None:
        raise DomainError(404, "period_not_found", period)
    if pr["status"] == "closed":
        raise DomainError(409, "already_closed", "period already closed")

    tb = _trial_balance(ctx, period)
    if not tb["balanced"]:
        raise DomainError(422, "trial_balance_unbalanced",
                          f"trial balance is out by {round(tb['totalDebit'] - tb['totalCredit'], 2)}")

    recs = [r for r in ctx.state.table("reconciliations").values() if r.get("period") == period]
    pending = [r["reconciliationId"] for r in recs if r["status"] == "in_progress"]
    if pending:
        raise DomainError(409, "reconciliations_incomplete",
                          f"{len(pending)} reconciliation(s) still in progress")
    warnings = [{"reconciliationId": r["reconciliationId"], "accountNo": r["accountNo"],
                 "difference": r.get("difference")}
                for r in recs if r["status"] == "exception"]

    for task in pr["checklist"]:
        task["status"] = "complete"
    pr["status"] = "closed"
    pr["closedAt"] = base.now()
    pr["closedBy"] = ctx.get("closedBy", "api-token@slate-ledger.test")
    pr["trialBalance"] = {"totalDebit": tb["totalDebit"], "totalCredit": tb["totalCredit"]}
    pr["openExceptions"] = warnings
    return pr
