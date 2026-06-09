"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Runnable reference implementation of the Lynx Capital multi-tenant SDK flows: managed
platform auth, per-tenant DCR auth, labelled agent spawning, delegated narrowing, and
gateway resource authorization, with secure token handling and production error handling.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from app import caracal, tenancy

PROVISIONED_PATH = ROOT / "config" / "provisioned.json"


def _redact(secret: str | None) -> str:
    """Never echo a credential; show only enough to correlate it in logs."""
    if not secret:
        return "<none>"
    return f"{secret[:4]}…{secret[-2:]}" if len(secret) > 8 else "<set>"


def load_provisioned() -> dict:
    if not PROVISIONED_PATH.exists():
        return {}
    return json.loads(PROVISIONED_PATH.read_text(encoding="utf-8"))


def describe_plan() -> None:
    """Offline view of the architecture the SDK flows operate over. Always runnable."""
    model = tenancy.load_model()
    print(f"platform managed application: {model.platform.applicationName}")
    print("resources:")
    for resource in model.resources:
        print(f"  {resource.identifier}  scopes={resource.scopes}")
    print("tenants:")
    for tenant in model.tenants:
        print(f"  {tenant.id} ({tenant.name})  dcr_app={tenant.dcrApplicationName}")
        for role in tenant.agents:
            labels = tenancy.agent_labels(tenant.id, role)
            scopes = tenancy.role_scopes(role)
            print(f"    agent {role:<10} labels={labels} scopes={scopes}")


async def run_tenant_flows(tenant_id: str) -> None:
    """Live demonstration for one tenant: spawn each role agent under the managed
    platform application, then hand a narrowed subtask to a peer capability. Each agent
    session carries the tenant binding and capability labels the policy library keys on."""
    model = tenancy.load_model()
    tenant = next(t for t in model.tenants if t.id == tenant_id)
    for role in tenant.agents:
        spawn = caracal.spawn_agent(tenant.id, role)
        if spawn is None:
            print(f"[{tenant.id}] caracal not configured; skipping live spawn for {role}")
            return
        try:
            async with spawn as ctx:
                print(f"[{tenant.id}] spawned {role} agent  session={ctx.agent_id}")
                await demonstrate_gateway(tenant.id, role, ctx)
                await demonstrate_delegation(tenant.id, role, ctx)
        except Exception as exc:  # noqa: BLE001 — surface the failure class, fail closed.
            print(f"[{tenant.id}] {role} flow failed ({type(exc).__name__}): {exc}")


async def demonstrate_gateway(tenant_id: str, role: str, ctx) -> None:
    """Authorize a read against the role's primary resource through the gateway. A
    cross-tenant or out-of-scope request is denied by policy before any upstream call."""
    resource = {"portfolio": "portfolio", "research": "research", "compliance": "compliance"}.get(role)
    if not resource:
        return
    try:
        response = caracal.gateway_call(resource, "read", {"tenant": tenant_id})
        print(f"[{tenant_id}] {role} gateway {resource}:read -> {response.status_code}")
    except Exception as exc:  # noqa: BLE001
        print(f"[{tenant_id}] {role} gateway {resource}:read denied/failed ({type(exc).__name__})")


async def demonstrate_delegation(tenant_id: str, role: str, ctx) -> None:
    """Hand a research-read subtask to a child agent narrowed below the parent's
    authority — delegated, least-privilege fan-out that stays inside the tenant."""
    if role != "portfolio":
        return
    child = caracal.spawn_agent(tenant_id, "research", parent_ctx=ctx, ttl_seconds=300)
    if child is None:
        return
    async with child as sub:
        print(f"[{tenant_id}] delegated research subtask  child_session={sub.agent_id}")


async def main() -> None:
    describe_plan()
    if not caracal.enabled():
        print("\nCaracal is not configured (set CARACAL_ZONE_ID and CARACAL_APPLICATION_ID).")
        print("Plan shown above is valid offline; run provisioning to exercise live flows.")
        return
    provisioned = load_provisioned()
    print(f"\nmanaged application secret: {_redact(os.environ.get('CARACAL_APP_CLIENT_SECRET'))}")
    print(f"provisioned tenants: {list((provisioned.get('tenants') or {}).keys())}")
    try:
        for tenant in tenancy.load_model().tenants:
            await run_tenant_flows(tenant.id)
    finally:
        await caracal.aclose()


if __name__ == "__main__":
    asyncio.run(main())
