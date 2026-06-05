"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Tallyhall Books domain: SMB accounting vendors, bills, bill matching, customer invoices, and payments.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "tallyhall-books"


@base.seeder(ID)
def seed(state: base.State) -> None:
    vendors = gen.vendors(ID, 80)
    state.tables["vendors"] = gen.index_by(vendors)
    state.tables["bills"] = {}
    state.tables["invoices"] = {}
    state.tables["payments"] = {}
    accts = gen.accounts(ID, 8)
    state.tables["accounts"] = gen.index_by(accts)


@base.op(ID, "list_vendors")
def list_vendors(ctx: Ctx) -> dict:
    ctx.require_scope("accounting.read")
    return ctx.paginate(list(ctx.state.table("vendors").values()), size_default=20)


@base.op(ID, "get_vendor")
def get_vendor(ctx: Ctx) -> dict:
    ctx.require_scope("accounting.read")
    ctx.require("vendorId")
    vendor = ctx.state.table("vendors").get(ctx.payload["vendorId"])
    if vendor is None:
        raise DomainError(404, "vendor_not_found", ctx.payload["vendorId"])
    return vendor


@base.op(ID, "create_bill")
def create_bill(ctx: Ctx) -> dict:
    ctx.require_scope("accounting.write")
    ctx.require("vendorId", "amount")
    if ctx.payload["vendorId"] not in ctx.state.table("vendors"):
        raise DomainError(404, "vendor_not_found", ctx.payload["vendorId"])
    bill = {"billId": base.new_id("bill"), "vendorId": ctx.payload["vendorId"],
            "amount": float(ctx.payload["amount"]), "status": "unmatched",
            "currency": ctx.get("currency", "USD")}
    ctx.state.table("bills")[bill["billId"]] = bill
    return bill


@base.op(ID, "match_bill")
def match_bill(ctx: Ctx) -> dict:
    ctx.require_scope("accounting.write")
    ctx.require("billId")
    bill = ctx.state.table("bills").get(ctx.payload["billId"])
    if bill is None:
        raise DomainError(404, "bill_not_found", ctx.payload["billId"])
    if bill["status"] == "matched":
        raise DomainError(409, "already_matched", "bill is already matched")
    bill["status"] = "matched"
    bill["poRef"] = ctx.get("poRef")
    return bill


@base.op(ID, "create_invoice")
def create_invoice(ctx: Ctx) -> dict:
    ctx.require_scope("accounting.write")
    ctx.require("customer", "amount")
    invoice = {"invoiceId": base.new_id("inv"), "customer": ctx.payload["customer"],
               "amount": float(ctx.payload["amount"]), "status": "sent",
               "currency": ctx.get("currency", "USD")}
    ctx.state.table("invoices")[invoice["invoiceId"]] = invoice
    return invoice


@base.op(ID, "record_payment")
def record_payment(ctx: Ctx) -> dict:
    ctx.require_scope("accounting.write")
    ctx.require("billId", "amount")
    bill = ctx.state.table("bills").get(ctx.payload["billId"])
    if bill is None:
        raise DomainError(404, "bill_not_found", ctx.payload["billId"])
    payment = {"paymentId": base.new_id("pay"), "billId": bill["billId"],
               "amount": float(ctx.payload["amount"]), "status": "cleared"}
    bill["status"] = "paid"
    ctx.state.table("payments")[payment["paymentId"]] = payment
    return payment


@base.op(ID, "get_account")
def get_account(ctx: Ctx) -> dict:
    ctx.require_scope("accounting.read")
    ctx.require("accountId")
    acct = ctx.state.table("accounts").get(ctx.payload["accountId"])
    if acct is None:
        raise DomainError(404, "account_not_found", ctx.payload["accountId"])
    return acct
