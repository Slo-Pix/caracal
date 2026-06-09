"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Caracal SDK seam for the Lynx Capital platform: the one managed-application client, the
per-customer agent spawn and delegation flows, and the gateway and verifier paths the
application authorizes through.
"""
from __future__ import annotations

import os
import threading
from typing import Any

import httpx

# Caracal runtime client and authority primitives from the published SDK.
from caracalai_sdk import Caracal, CaracalContext, DelegationConstraints, Grant
# Caracal verifier primitives used to authenticate inbound authority before serving
# internal providers.
from caracalai_identity import (
    JwtConfig,
    MANDATE_USE_RESOURCE,
    TokenInvalidError,
    ScopeInsufficientError,
    ZoneInvalidError,
    verify_config,
)

from app import tenancy

_lock = threading.Lock()
_client: Caracal | None = None
_built = False

# Default least-privilege envelope for a spawned customer agent: one delegation hop and a
# short time-to-live so a leaked child mandate cannot be re-delegated or outlive its run.
DEFAULT_AGENT_TTL_SECONDS = 600
DEFAULT_AGENT_BUDGET = 5


def enabled() -> bool:
    """Caracal routing is active when a runtime profile or the managed application identity
    is configured; absent that, the app falls back to the direct local provider path."""
    if os.environ.get("CARACAL_CONFIG"):
        return True
    return bool(os.environ.get("CARACAL_ZONE_ID") and os.environ.get("CARACAL_APPLICATION_ID"))


def _allow_root() -> bool:
    """Bootstrap escape hatch: when set, upstream calls may use the platform's own service
    identity instead of a delegated agent mandate. Off by default so hot paths never
    silently leak root authority."""
    return os.environ.get("CARACAL_ALLOW_ROOT", "").strip().lower() in ("1", "true", "yes", "on")


def runtime() -> Caracal | None:
    """Build (once) and return the process-wide managed application client, or None when the
    integration is not configured. `connect()` reads the Console-generated runtime profile
    when present and otherwise the workload environment; service URLs resolve from there, so
    the application never hardcodes an STS, gateway, or coordinator address. This one durable
    managed application backs every customer's agent sessions."""
    global _client, _built
    if not enabled():
        return None
    with _lock:
        if not _built:
            _client = Caracal.connect()
            _built = True
        return _client


async def aclose() -> None:
    """Release the SDK client's pooled transports and background token refresh."""
    global _client, _built
    with _lock:
        client, _client, _built = _client, None, False
    if client is not None:
        await client.close()


def context_middleware():
    """ASGI middleware factory that establishes the inbound Caracal context for each request
    so delegated authority propagates into the run, or None when off."""
    client = runtime()
    if client is None:
        return None
    return client.context_middleware(allow_root=_allow_root())


def spawn(**kwargs: Any):
    """Open a delegated agent context for a run so every downstream upstream call carries a
    scoped, non-root mandate. Returns an async context manager."""
    client = runtime()
    if client is None:
        return None
    return client.spawn(**kwargs)


def spawn_customer_agent(
    customer_id: str,
    role: str,
    *,
    parent_ctx: CaracalContext | None = None,
    ttl_seconds: int = DEFAULT_AGENT_TTL_SECONDS,
    budget: int = DEFAULT_AGENT_BUDGET,
):
    """Spawn one customer's role agent under the managed platform application.

    The customer the agent serves travels in the spawn metadata (and, in production, in the
    customer's subject token); it is never a separate application or a scope name. The agent
    session carries only the role's capability labels — which the policy set keys on — and a
    delegation edge narrowed to the role's least-privilege scopes, capped to a single hop, a
    short TTL, and an explicit call budget. Effective authority is the intersection of policy,
    this grant, the resource, and any inherited delegation, so the agent can never exceed the
    role. Returns an async context manager, or None when Caracal is not configured."""
    client = runtime()
    if client is None:
        return None
    scopes = tenancy.role_scopes(role)
    constraints = DelegationConstraints(max_hops=1, budget=budget, ttl_seconds=ttl_seconds)
    grant = Grant.narrow(scopes, constraints=constraints, ttl_seconds=ttl_seconds) if scopes else Grant.none()
    return client.spawn(
        grant=grant,
        labels=tenancy.agent_labels(role),
        metadata=tenancy.customer_metadata(customer_id, role),
        parent_ctx=parent_ctx,
        ttl_seconds=ttl_seconds,
    )


async def fetch(resource_id: str, path: str, *, method: str = "GET", **kwargs: Any) -> httpx.Response:
    """Call an upstream resource through the Caracal Gateway from within a bound agent
    context. The Gateway validates the mandate, selects the upstream by resource id, injects
    the provider credential it holds, and forwards the call, so the agent never sees the
    third-party secret."""
    client = runtime()
    if client is None:
        raise RuntimeError("fetch requires Caracal to be configured")
    return await client.fetch(resource_id, path, method=method, **kwargs)


def _envelope_headers(client: Caracal) -> dict[str, str]:
    """Project the active delegated context into Caracal envelope headers. Fails closed when
    no context is bound unless root identity is explicitly permitted, so a token is never
    leaked from a background task that escaped the request context."""
    return client.headers(allow_root=_allow_root())


def gateway_call(resource_id: str, operation: str, payload: dict, *, timeout_s: float = 6.0) -> httpx.Response:
    """Route an external provider operation through the Caracal upstream gateway.

    The gateway validates the Caracal envelope, selects the upstream by resource id, injects
    the provider credential it holds, and forwards the call — so the application itself never
    sees the third-party secret."""
    client = runtime()
    if client is None:
        raise RuntimeError("gateway_call requires Caracal to be configured")
    request = client.gateway_request(resource_id, f"/api/{operation}")
    headers = {**request.headers, **_envelope_headers(client)}
    with httpx.Client(timeout=timeout_s) as http:
        return http.post(request.url, json=payload, headers=headers)


def verify_internal(*, zone_id: str, audience: str, required_scopes: list[str] | None = None):
    """Authenticate the active authority for an internal provider using the Caracal verifier,
    then return its claims. Internal providers are not network-exposed, so authority is checked
    in-process here at their trust boundary rather than at a gateway."""
    client = runtime()
    if client is None:
        raise RuntimeError("verify_internal requires Caracal to be configured")
    headers = _envelope_headers(client)
    token = headers.get("Authorization", "")
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    config = JwtConfig(
        issuer=os.environ.get("CARACAL_ISSUER", os.environ.get("CARACAL_STS_URL", "")),
        audience=audience,
        expected_zone_id=zone_id,
        required_scopes=list(required_scopes or []),
        required_use=MANDATE_USE_RESOURCE,
    )
    return verify_config(token, config)


# Re-export the verifier's typed failures so callers can fail closed precisely.
VerifyErrors = (TokenInvalidError, ScopeInsufficientError, ZoneInvalidError)

__all__ = [
    "enabled",
    "runtime",
    "aclose",
    "context_middleware",
    "spawn",
    "spawn_customer_agent",
    "fetch",
    "gateway_call",
    "verify_internal",
    "VerifyErrors",
    "CaracalContext",
]
