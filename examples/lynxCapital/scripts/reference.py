"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Runnable reference implementation of the Lynx Capital SDK flows: per-service managed
application connect, per-customer least-privilege agent spawning, gateway resource
authorization, and delegated narrowing, with secure token handling and production error
handling.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from app import caracal, tenancy


def _redact(secret: str | None) -> str:
    """Never echo a credential; show only enough to correlate it in logs."""
    if not secret:
        return "<none>"
    return f"{secret[:4]}…{secret[-2:]}" if len(secret) > 8 else "<set>"


def describe_plan() -> None:
    """Offline view of the architecture the SDK flows operate over. Always runnable."""
    model = tenancy.load_model()
    print("service applications:")
    for app in model.applications:
        print(f"  {app.applicationName}  resource={app.resource.identifier}  scopes={app.resource.scopes}")
        for role in app.agents:
            labels = tenancy.agent_labels(role)
            scopes = tenancy.role_scopes(role, application=app.id)
            print(f"    agent {role:<10} labels={labels} scopes={scopes}")
    print("customers (subjects):")
    for customer in model.customers:
        print(f"  {customer.id} ({customer.name})  subject={customer.subject}  plan={customer.plan}")


async def demonstrate_gateway(customer_id: str, application_id: str, resource_id: str) -> None:
    """Authorize a read against the application's resource through the Gateway. An
    out-of-scope or cross-customer request is denied by policy before any upstream call."""
    try:
        response = await caracal.fetch(resource_id, "/api/read", method="GET")
        print(f"[{customer_id}] {application_id} gateway {resource_id}:read -> {response.status_code}")
    except Exception as exc:  # noqa: BLE001 — surface the failure class, fail closed.
        print(f"[{customer_id}] {application_id} gateway {resource_id}:read denied/failed ({type(exc).__name__})")


async def demonstrate_delegation(customer_id: str, application_id: str, role: str, parent_ctx) -> None:
    """Hand a read subtask to a child agent narrowed below the parent's authority — delegated,
    least-privilege fan-out that still acts for the same customer under the same application."""
    child = caracal.spawn_customer_agent(
        customer_id, role, application_id=application_id, parent_ctx=parent_ctx, ttl_seconds=300
    )
    if child is None:
        return
    async with child as sub:
        print(f"[{customer_id}] delegated {role} subtask  child_session={sub.agent_session_id}")


async def run_customer_flows(customer_id: str) -> None:
    """Live demonstration for one customer: spawn each application's agents under that service's
    managed application, scoped to least privilege and correlated to the customer in metadata."""
    model = tenancy.load_model()
    for app in model.applications:
        for role in app.agents:
            spawn = caracal.spawn_customer_agent(customer_id, role, application_id=app.id)
            if spawn is None:
                print(f"[{customer_id}] caracal not configured; skipping live spawn for {app.id}/{role}")
                return
            try:
                async with spawn as ctx:
                    print(f"[{customer_id}] spawned {app.id}/{role} agent  session={ctx.agent_session_id}")
                    await demonstrate_gateway(customer_id, app.id, app.resource.resourceId)
                    if role == "auditor":
                        await demonstrate_delegation(customer_id, app.id, role, ctx)
            except Exception as exc:  # noqa: BLE001 — surface the failure class, fail closed.
                print(f"[{customer_id}] {app.id}/{role} flow failed ({type(exc).__name__}): {exc}")


async def main() -> None:
    describe_plan()
    if not caracal.enabled():
        print("\nCaracal is not configured (set CARACAL_CONFIG, or CARACAL_ZONE_ID and CARACAL_APPLICATION_ID).")
        print("The plan above is valid offline; provision the zone to exercise the live flows.")
        return
    print(f"\nmanaged application: {os.environ.get('CARACAL_APPLICATION_ID', '<unset>')}")
    print(f"managed application secret: {_redact(os.environ.get('CARACAL_APP_CLIENT_SECRET'))}")
    try:
        for customer in tenancy.load_model().customers:
            await run_customer_flows(customer.id)
    finally:
        await caracal.aclose()


if __name__ == "__main__":
    asyncio.run(main())
