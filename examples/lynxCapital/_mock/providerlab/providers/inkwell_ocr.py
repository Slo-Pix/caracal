"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Inkwell OCR domain: asynchronous invoice document capture with field extraction and confidence scoring.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "inkwell-ocr"


@base.seeder(ID)
def seed(state: base.State) -> None:
    state.tables["documents"] = {}
    state.tables["extractions"] = {}


@base.op(ID, "submit_document")
def submit_document(ctx: Ctx) -> dict:
    """Queue a document for OCR; extraction completes asynchronously on first poll."""
    ctx.require("fileName")
    doc = {"documentId": base.new_id("doc"), "fileName": ctx.payload["fileName"],
           "status": "processing", "pages": int(ctx.get("pages", 1))}
    ctx.state.table("documents")[doc["documentId"]] = doc
    return doc


@base.op(ID, "get_extraction")
def get_extraction(ctx: Ctx) -> dict:
    ctx.require("documentId")
    doc = ctx.state.table("documents").get(ctx.payload["documentId"])
    if doc is None:
        raise DomainError(404, "document_not_found", ctx.payload["documentId"])
    extractions = ctx.state.table("extractions")
    if doc["documentId"] in extractions:
        return extractions[doc["documentId"]]
    rng = gen._rng(ID, "extract", doc["documentId"])
    amount = round(rng.uniform(180, 96000), 2)
    extraction = {
        "documentId": doc["documentId"], "status": "extracted",
        "fields": {
            "vendorName": gen._company(rng),
            "invoiceNumber": f"{rng.choice(('INV','BILL','AP'))}-{rng.randint(10000, 99999)}",
            "amount": amount,
            "currency": rng.choice(("USD", "EUR", "GBP")),
            "dueDate": gen._day(rng, 5, 60),
            "taxId": f"US{rng.randint(10**8, 10**9 - 1)}",
        },
        "confidence": round(rng.uniform(0.82, 0.99), 3),
    }
    doc["status"] = "extracted"
    extractions[doc["documentId"]] = extraction
    return extraction


@base.op(ID, "list_documents")
def list_documents(ctx: Ctx) -> dict:
    items = list(ctx.state.table("documents").values())
    status = ctx.get("status")
    if status:
        items = [d for d in items if d["status"] == status]
    return ctx.paginate(items, size_default=20)
