"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Mock Caracal mandate signer and verifier mimicking the verifier SDK boundary semantics for partnership providers.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

from _mock.providerlab import jwtmini

ISSUER = "https://zone.caracal.test"


@dataclass
class MandateClaims:
    zone: str
    resource: str
    scopes: list[str]
    subject: str
    session_id: str
    root_session_id: str
    agent_session_id: str | None = None
    delegation_edge_id: str | None = None
    ttl_seconds: int = 300


class VerifyError(Exception):
    """Raised when a mandate fails verification, mirroring verifier SDK error codes."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


def sign(claims: MandateClaims, signing_key: str) -> str:
    now = int(time.time())
    payload = {
        "iss": ISSUER,
        "aud": claims.resource,
        "zone": claims.zone,
        "sub": claims.subject,
        "scopes": claims.scopes,
        "sid": claims.session_id,
        "root_sid": claims.root_session_id,
        "iat": now,
        "exp": now + claims.ttl_seconds,
        "jti": uuid.uuid4().hex,
    }
    if claims.agent_session_id:
        payload["agent_session_id"] = claims.agent_session_id
    if claims.delegation_edge_id:
        payload["delegation_edge_id"] = claims.delegation_edge_id
    return jwtmini.encode(payload, signing_key, kid="zone-signing-key")


def verify(
    token: str,
    signing_key: str,
    *,
    zone: str,
    resource: str,
    required_scopes: list[str],
    revoked: set[str],
    require_delegation: bool = False,
) -> dict:
    """Verify a mandate the way a Caracal verifier SDK at the upstream boundary would."""
    if not token:
        raise VerifyError("missing_token", "no mandate presented")
    try:
        claims = jwtmini.decode(token, signing_key)
    except jwtmini.JwtError as exc:
        msg = str(exc)
        if "expired" in msg:
            raise VerifyError("invalid_token", "mandate expired") from exc
        raise VerifyError("invalid_token", "mandate signature invalid") from exc
    if claims.get("iss") != ISSUER:
        raise VerifyError("invalid_token", "unexpected issuer")
    if claims.get("zone") != zone:
        raise VerifyError("invalid_zone", "mandate zone mismatch")
    if claims.get("aud") != resource:
        raise VerifyError("invalid_token", "mandate audience mismatch")
    granted = set(claims.get("scopes", []))
    if not set(required_scopes).issubset(granted):
        raise VerifyError("insufficient_scope", "mandate missing required scopes")
    for anchor in ("sid", "root_sid", "agent_session_id", "delegation_edge_id"):
        value = claims.get(anchor)
        if value and value in revoked:
            raise VerifyError("session_revoked", f"mandate anchor revoked: {anchor}")
    if require_delegation and not claims.get("delegation_edge_id"):
        raise VerifyError("delegation_required", "resource requires a delegated mandate")
    return claims
