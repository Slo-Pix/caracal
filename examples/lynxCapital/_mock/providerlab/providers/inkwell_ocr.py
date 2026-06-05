"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Inkwell OCR domain: asynchronous document capture with classification, field-level extraction, line items, and confidence scoring.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "inkwell-ocr"


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@base.seeder(ID)
def seed(state: base.State) -> None:
    for name, table in gen.inkwell_dataset(ID).items():
        state.tables[name] = table


@base.op(ID, "submit_document")
def submit_document(ctx: Ctx) -> dict:
    """Queue a document for capture; extraction completes asynchronously and is read back via get_extraction."""
    ctx.require("fileName")
    file_name = str(ctx.payload["fileName"])
    mime = gen.inkwell_mime(file_name)
    if mime is None:
        raise DomainError(415, "unsupported_media_type",
                          f"cannot process {file_name!r}; supported types are PDF, PNG, JPEG, TIFF, WEBP, and HEIC")
    models = ctx.state.table("models")
    model = str(ctx.get("model", "invoice"))
    if model not in models:
        raise DomainError(422, "unknown_model", f"model {model!r} is not available; see list_models")

    rng = gen._rng(ID, "submit", file_name, ctx.get("reference") or "")
    doc_id = base.new_id("doc")
    doc = {
        "documentId": doc_id,
        "object": "document",
        "fileName": file_name,
        "mimeType": mime,
        "sizeBytes": int(ctx.get("sizeBytes") or rng.randint(48_000, 5_200_000)),
        "sha256": hashlib.sha256(f"{doc_id}:{file_name}".encode()).hexdigest(),
        "pageCount": int(ctx.get("pages") or rng.choice((1, 1, 1, 2, 3, 5))),
        "model": model,
        "modelVersion": models[model]["version"],
        "documentType": None,
        "status": "processing",
        "source": "api_upload",
        "reference": ctx.get("reference"),
        "callbackUrl": ctx.get("callbackUrl"),
        "createdAt": _iso_now(),
        "completedAt": None,
        "confidence": None,
    }
    ctx.state.table("documents")[doc_id] = doc
    return doc


@base.op(ID, "get_document")
def get_document(ctx: Ctx) -> dict:
    ctx.require("documentId")
    doc = ctx.state.table("documents").get(ctx.payload["documentId"])
    if doc is None:
        raise DomainError(404, "document_not_found", ctx.payload["documentId"])
    return doc


@base.op(ID, "get_extraction")
def get_extraction(ctx: Ctx) -> dict:
    """Return the extraction, completing the queued capture on the first poll."""
    ctx.require("documentId")
    doc = ctx.state.table("documents").get(ctx.payload["documentId"])
    if doc is None:
        raise DomainError(404, "document_not_found", ctx.payload["documentId"])
    extractions = ctx.state.table("extractions")
    existing = extractions.get(doc["documentId"])
    if existing is not None:
        return existing

    extraction = gen.inkwell_extraction(doc)
    doc["status"] = extraction["status"]
    doc["documentType"] = extraction["documentType"]
    doc["confidence"] = extraction["confidence"]
    doc["completedAt"] = _iso_now()
    extractions[doc["documentId"]] = extraction
    return extraction


@base.op(ID, "list_documents")
def list_documents(ctx: Ctx) -> dict:
    items = list(ctx.state.table("documents").values())
    status = ctx.get("status")
    if status:
        items = [d for d in items if d["status"] == status]
    model = ctx.get("model")
    if model:
        items = [d for d in items if d["model"] == model]
    items.sort(key=lambda d: d["createdAt"], reverse=True)
    return ctx.paginate(items, size_default=20)


@base.op(ID, "list_models")
def list_models(ctx: Ctx) -> dict:
    return {"object": "list", "data": list(ctx.state.table("models").values())}


@base.op(ID, "delete_document")
def delete_document(ctx: Ctx) -> dict:
    """Purge a document and its extraction, as a retention or right-to-erasure request would."""
    ctx.require("documentId")
    documents = ctx.state.table("documents")
    document_id = ctx.payload["documentId"]
    if document_id not in documents:
        raise DomainError(404, "document_not_found", document_id)
    documents.pop(document_id)
    ctx.state.table("extractions").pop(document_id, None)
    return {"documentId": document_id, "object": "document", "deleted": True}
