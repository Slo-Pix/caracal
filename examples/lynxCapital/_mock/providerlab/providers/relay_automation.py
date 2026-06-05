"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Relay Automation domain: mandate-guarded MCP workflow catalog with asynchronous job dispatch, status, and cancellation.
"""
from __future__ import annotations

from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "relay-automation"

_WORKFLOWS = {
    "ap_close_batch": {"id": "ap_close_batch", "name": "AP Close Batch", "steps": 4},
    "vendor_onboard": {"id": "vendor_onboard", "name": "Vendor Onboarding", "steps": 6},
    "statement_recon": {"id": "statement_recon", "name": "Statement Reconciliation", "steps": 3},
    "payout_release": {"id": "payout_release", "name": "Payout Release", "steps": 5},
}


@base.seeder(ID)
def seed(state: base.State) -> None:
    state.tables["workflows"] = dict(_WORKFLOWS)
    state.tables["jobs"] = {}


@base.op(ID, "list_workflows")
def list_workflows(ctx: Ctx) -> dict:
    ctx.require_scope("relay.invoke")
    return {"items": list(ctx.state.table("workflows").values())}


@base.op(ID, "dispatch_job")
def dispatch_job(ctx: Ctx) -> dict:
    ctx.require_scope("relay.invoke")
    ctx.require("workflowId")
    workflow = ctx.state.table("workflows").get(ctx.payload["workflowId"])
    if workflow is None:
        raise DomainError(404, "workflow_not_found", ctx.payload["workflowId"])
    job = {"jobId": base.new_id("job"), "workflowId": workflow["id"], "status": "running",
           "step": 0, "steps": workflow["steps"], "input": ctx.get("input", {})}
    ctx.state.table("jobs")[job["jobId"]] = job
    return job


@base.op(ID, "get_job")
def get_job(ctx: Ctx) -> dict:
    ctx.require_scope("relay.invoke")
    ctx.require("jobId")
    job = ctx.state.table("jobs").get(ctx.payload["jobId"])
    if job is None:
        raise DomainError(404, "job_not_found", ctx.payload["jobId"])
    if job["status"] == "running":
        job["step"] += 1
        if job["step"] >= job["steps"]:
            job["status"] = "succeeded"
    return job


@base.op(ID, "cancel_job")
def cancel_job(ctx: Ctx) -> dict:
    ctx.require_scope("relay.invoke")
    ctx.require("jobId")
    job = ctx.state.table("jobs").get(ctx.payload["jobId"])
    if job is None:
        raise DomainError(404, "job_not_found", ctx.payload["jobId"])
    if job["status"] in ("succeeded", "cancelled"):
        raise DomainError(409, "job_terminal", "job already finished")
    job["status"] = "cancelled"
    return job
