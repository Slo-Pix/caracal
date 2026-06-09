"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Single owner of the Caracal SDK client that routes external providers through the upstream gateway and guards internal providers with the verifier.
"""
from __future__ import annotations

import os
import threading
from typing import Any

import httpx

# Caracal runtime client and configuration types from the published SDK (v2026.06.09-rc.1 / caracalai-sdk==0.1.5rc1).
from caracalai_sdk import Caracal, CaracalContext
# Caracal verifier primitives used to authenticate inbound authority before serving internal providers.
from caracalai_identity import (
    JwtConfig,
    MANDATE_USE_RESOURCE,
    TokenInvalidError,
    ScopeInsufficientError,
    ZoneInvalidError,
    verify_config,
)

_lock = threading.Lock()
_client: Caracal | None = None
_built = False


def enabled() -> bool:
    """Caracal routing is active only when the application identity is configured;
    absent that, the app falls back to the direct local provider path."""
    return bool(os.environ.get("CARACAL_ZONE_ID") and os.environ.get("CARACAL_APPLICATION_ID"))


def _allow_root() -> bool:
    """Bootstrap escape hatch: when set, upstream calls may use the application's
    own service identity instead of a delegated agent mandate. Off by default so
    hot paths never silently leak root authority."""
    return os.environ.get("CARACAL_ALLOW_ROOT", "").strip().lower() in ("1", "true", "yes", "on")


def runtime() -> Caracal | None:
    """Build (once) and return the process-wide Caracal client, or None when the
    integration is not configured."""
    global _client, _built
    if not enabled():
        return None
    with _lock:
        if not _built:
            # Construct the bound client from CARACAL_* environment: zone, application id,
            # STS/coordinator/gateway URLs, the application client secret (token exchange),
            # and the resource bindings that map each provider to its gateway upstream.
            _client = Caracal.from_env()
            _built = True
        return _client


async def aclose() -> None:
    """Release the SDK client's pooled transports and background token refresh."""
    global _client, _built
    with _lock:
        client, _client, _built = _client, None, False
    if client is not None:
        # Close the Caracal client (HTTP pools, coordinator client, token source).
        await client.close()


def context_middleware():
    """ASGI middleware factory that establishes the inbound Caracal context for
    each request so delegated authority propagates into the run, or None when off."""
    client = runtime()
    if client is None:
        return None
    # Install the SDK's context middleware; it binds a CaracalContext from inbound
    # headers (falling back to the application identity only when allow_root is set).
    return client.context_middleware(allow_root=_allow_root())


def spawn(**kwargs: Any):
    """Open a delegated agent context for a run so every downstream upstream call
    carries a scoped, non-root mandate. Returns an async context manager."""
    client = runtime()
    if client is None:
        return None
    # Spawn a child agent identity at the coordinator and bind it to the current task.
    return client.spawn(**kwargs)


def _envelope_headers(client: Caracal) -> dict[str, str]:
    """Project the active delegated context into Caracal envelope headers."""
    # Serialize the bound CaracalContext (mandate + delegation anchors) to headers;
    # raises if no context is bound unless root identity is explicitly permitted.
    return client.headers(allow_root=_allow_root())


def gateway_call(resource_id: str, operation: str, payload: dict, *, timeout_s: float = 6.0) -> httpx.Response:
    """Route an external provider operation through the Caracal upstream gateway.

    The gateway validates the Caracal envelope, selects the upstream by resource id,
    injects the provider credential it holds, and forwards the call — so the
    application itself never sees the third-party secret."""
    client = runtime()
    if client is None:
        raise RuntimeError("gateway_call requires Caracal to be configured")
    # Resolve the gateway URL and the resource-selector header for this provider+path.
    request = client.gateway_request(resource_id, f"/api/{operation}")
    # Combine the resource selector with the delegated authority envelope.
    headers = {**request.headers, **_envelope_headers(client)}
    with httpx.Client(timeout=timeout_s) as http:
        return http.post(request.url, json=payload, headers=headers)


def verify_internal(*, zone_id: str, audience: str, required_scopes: list[str] | None = None):
    """Authenticate the active authority for an internal provider using the Caracal
    verifier, then return its claims. Internal providers are not network-exposed, so
    authority is checked in-process here at their trust boundary rather than at a gateway."""
    client = runtime()
    if client is None:
        raise RuntimeError("verify_internal requires Caracal to be configured")
    # Take the current envelope and extract the mandate bearer token to verify.
    headers = _envelope_headers(client)
    token = headers.get("Authorization", "")
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    # Configure the verifier to enforce zone, audience, resource-use, and scopes.
    config = JwtConfig(
        issuer=os.environ.get("CARACAL_ISSUER", os.environ.get("CARACAL_STS_URL", "")),
        audience=audience,
        expected_zone_id=zone_id,
        required_scopes=list(required_scopes or []),
        required_use=MANDATE_USE_RESOURCE,
    )
    # Verify signature, expiry, zone, audience, use, and scopes; raises on failure.
    return verify_config(token, config)


# Re-export the verifier's typed failures so callers can fail closed precisely.
VerifyErrors = (TokenInvalidError, ScopeInsufficientError, ZoneInvalidError)

__all__ = [
    "enabled",
    "runtime",
    "aclose",
    "context_middleware",
    "spawn",
    "gateway_call",
    "verify_internal",
    "VerifyErrors",
    "CaracalContext",
]
