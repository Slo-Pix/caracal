"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Lynx Capital's Caracal singleton: loads caracal.toml via the SDK and exposes a small accessor surface to the swarm.
"""
from __future__ import annotations

from contextlib import AsyncExitStack
from typing import Any

from caracalai_sdk import Caracal, CaracalContext
from caracalai_sdk.coordinator import AgentKind, DelegationConstraints

from app.agents.roles import ROLES


_caracal: Caracal | None = None


def init() -> Caracal:
    global _caracal
    if _caracal is None:
        _caracal = Caracal.from_config()
    return _caracal


def get() -> Caracal | None:
    return _caracal


def headers() -> dict[str, str]:
    """Project the SDK's current Caracal context into outbound headers.

    Background transports (gRPC clients, SSE consumers, MCP sockets) reach
    here from tasks that do not inherit the orchestrator's contextvar; in
    that case there is no bound child context and the application's service
    identity is the correct one to send. ``allow_root=True`` makes that
    intent explicit instead of relying on a silent fallback.
    """
    return _caracal.headers(allow_root=True) if _caracal is not None else {}


def _scopes_for(role: str, region: str | None, scope: str | None) -> list[str]:
    """Derive coordinator delegation scopes from a role definition.

    The role registry owns scope_template; this turns the rendered scope into
    the coordinator wire form (`role:region:rendered-scope`)."""
    rdef = ROLES.get(role)
    base = role
    rendered = scope or (rdef.scope_template if rdef else "")
    parts = [base]
    if region:
        parts.append(region)
    if rendered:
        parts.append(rendered)
    return [":".join(parts)]


def _constraints_for(role: str) -> DelegationConstraints:
    rdef = ROLES.get(role)
    actions = list(rdef.allowed_tools) if rdef and rdef.allowed_tools else None
    return DelegationConstraints(actions=actions, max_depth=4)


async def enter(
    stack: AsyncExitStack,
    role: str,
    *,
    run_id: str,
    region: str | None = None,
    scope: str | None = None,
    kind: AgentKind = AgentKind.INSTANCE,
    ttl_seconds: int | None = None,
    extra: dict[str, Any] | None = None,
) -> CaracalContext | None:
    """Open a child Caracal context bound to the current async task.

    At the top of a run (no parent context active), spawns a new agent under
    the application's bootstrap subject. When a parent context is active —
    the regional orchestrator, a workflow orchestrator, etc. — issues a
    delegated spawn so the child carries a scoped subject token instead of
    inheriting the parent's authority verbatim."""
    if _caracal is None:
        return None
    meta: dict[str, Any] = {"role": role, "run_id": run_id}
    if region:
        meta["region"] = region
    if scope:
        meta["scope"] = scope
    if extra:
        meta.update(extra)

    parent = _caracal.current()
    if parent is None:
        return await stack.enter_async_context(
            _caracal.spawn(kind=kind, ttl_seconds=ttl_seconds, metadata=meta)
        )
    return await stack.enter_async_context(
        _caracal.delegate_to_spawn(
            scopes=_scopes_for(role, region, scope),
            constraints=_constraints_for(role),
            kind=kind,
            ttl_seconds=ttl_seconds,
            metadata=meta,
        )
    )


async def close() -> None:
    """Release the SDK's coordinator HTTP client. Idempotent."""
    global _caracal
    if _caracal is not None:
        await _caracal.close()
        _caracal = None
