"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Sabre Tax domain: tax determination, jurisdiction lookup, and tax-identifier validation.
"""
from __future__ import annotations

from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "sabre-tax"

_RATES = {
    "US-CA": 0.0825, "US-NY": 0.08875, "US-TX": 0.0625, "GB": 0.20,
    "DE": 0.19, "FR": 0.20, "SG": 0.09, "BR": 0.17, "JP": 0.10, "CA-ON": 0.13,
    "US": 0.30, "IN": 0.10,
}


@base.seeder(ID)
def seed(state: base.State) -> None:
    state.tables["calculations"] = {}


@base.op(ID, "calculate")
def calculate(ctx: Ctx) -> dict:
    ctx.require("amount", "jurisdiction")
    rate = _RATES.get(ctx.payload["jurisdiction"])
    if rate is None:
        raise DomainError(404, "jurisdiction_not_found", ctx.payload["jurisdiction"])
    amount = float(ctx.payload["amount"])
    if amount < 0:
        raise DomainError(422, "invalid_amount", "amount must be non-negative")
    tax = round(amount * rate, 2)
    calc = {"calculationId": base.new_id("calc"), "jurisdiction": ctx.payload["jurisdiction"],
            "rate": rate, "taxable": amount, "tax": tax, "total": round(amount + tax, 2)}
    ctx.state.table("calculations")[calc["calculationId"]] = calc
    return calc


@base.op(ID, "get_jurisdiction")
def get_jurisdiction(ctx: Ctx) -> dict:
    ctx.require("jurisdiction")
    rate = _RATES.get(ctx.payload["jurisdiction"])
    if rate is None:
        raise DomainError(404, "jurisdiction_not_found", ctx.payload["jurisdiction"])
    return {"jurisdiction": ctx.payload["jurisdiction"], "rate": rate, "type": "VAT/GST/Sales"}


@base.op(ID, "validate_id")
def validate_id(ctx: Ctx) -> dict:
    ctx.require("taxId", "country")
    tax_id = str(ctx.payload["taxId"])
    country = str(ctx.payload["country"])
    valid = tax_id.startswith(country) and len(tax_id) >= 9
    return {"taxId": tax_id, "country": country, "valid": valid,
            "format": "country-prefixed-numeric"}
