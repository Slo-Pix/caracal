"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Mock Caracal mandate signer and verifier mimicking the verifier SDK boundary semantics for partnership providers.
"""
from __future__ import annotations

import base64
import json
import os
import threading
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass

from _mock.providerlab import jwtmini, p256

ISSUER = "https://zone.caracal.test"

# Mandate "use" values mirror caracalai_identity: a resource mandate authorizes a
# call against a downstream provider, the audience the verifier binds to.
USE_RESOURCE = "resource"
USE_SESSION = "session"
SUBJECT_TYPES = ("user", "application")


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
    use: str = USE_RESOURCE
    subject_type: str = "application"
    ttl_seconds: int = 300


class VerifyError(Exception):
    """Raised when a mandate fails verification, mirroring verifier SDK error codes."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


_jwksLock = threading.Lock()
_jwksCache: dict[str, tuple[float, dict[str, tuple[int, int]]]] = {}
_JWKS_TTL_SECONDS = 300


def _b64url_uint(value: str) -> int:
    pad = "=" * (-len(value) % 4)
    return int.from_bytes(base64.urlsafe_b64decode(value + pad), "big")


def _zone_keys(zone_id: str) -> dict[str, tuple[int, int]]:
    """The zone's ES256 public keys from the Caracal STS JWKS, cached briefly so key
    rotation is picked up without a round trip per call."""
    now = time.time()
    with _jwksLock:
        cached = _jwksCache.get(zone_id)
        if cached is not None and now - cached[0] < _JWKS_TTL_SECONDS:
            return cached[1]
    sts_url = os.environ.get("CARACAL_STS_URL", "http://127.0.0.1:8080").rstrip("/")
    url = f"{sts_url}/.well-known/jwks.json?zone_id={zone_id}"
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            document = json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise VerifyError(
            "verifier_unavailable", "cannot reach Caracal STS for mandate verification"
        ) from exc
    keys = {
        key["kid"]: (_b64url_uint(key["x"]), _b64url_uint(key["y"]))
        for key in document.get("keys", [])
        if key.get("kty") == "EC" and key.get("crv") == "P-256" and key.get("kid")
    }
    with _jwksLock:
        _jwksCache[zone_id] = (now, keys)
    return keys


def _verify_caracal(token: str, claims: dict, kid: str, require_delegation: bool) -> dict:
    """Verify a Caracal STS-issued resource mandate the way a mandate-aware upstream
    does: ES256 signature against the zone JWKS, expiry, class, and delegation claims."""
    zone_id = claims.get("zone_id")
    if not isinstance(zone_id, str) or not zone_id:
        raise VerifyError("invalid_token", "mandate zone claim missing")
    expected_zone = os.environ.get("CARACAL_ZONE_ID", "").strip()
    if expected_zone and zone_id != expected_zone:
        raise VerifyError("invalid_zone", "mandate zone mismatch")
    key = _zone_keys(zone_id).get(kid)
    if key is None:
        raise VerifyError("invalid_token", "mandate signing key unknown to zone")
    header_b64, payload_b64, signature_b64 = token.split(".")
    pad = "=" * (-len(signature_b64) % 4)
    signature = base64.urlsafe_b64decode(signature_b64 + pad)
    if not p256.verify(key[0], key[1], f"{header_b64}.{payload_b64}".encode("ascii"), signature):
        raise VerifyError("invalid_token", "mandate signature invalid")
    if int(claims.get("exp", 0)) < int(time.time()):
        raise VerifyError("invalid_token", "mandate expired")
    if claims.get("use") not in (USE_RESOURCE, USE_SESSION):
        raise VerifyError("invalid_token", "mandate use claim missing or invalid")
    if claims.get("sub_type") not in SUBJECT_TYPES:
        raise VerifyError("invalid_token", "mandate subject type invalid")
    targets = list(claims.get("target") or [])
    if not targets:
        audience = claims.get("aud")
        candidates = [audience] if isinstance(audience, str) else list(audience or [])
        targets = [t for t in candidates if t.startswith("resource://")]
    if not targets or not all(t.startswith("resource://") for t in targets):
        raise VerifyError("invalid_token", "mandate names no resource view target")
    scopes = [s for s in str(claims.get("scope", "")).split() if s]
    # The zone policy validates the delegation edge at exchange time; the
    # re-issued upstream mandate carries the spawned agent session as the
    # delegation evidence.
    if require_delegation and not (
        claims.get("delegation_edge_id") or claims.get("agent_session_id")
    ):
        raise VerifyError("delegation_required", "resource requires a delegated mandate")
    return {
        "iss": claims.get("iss"),
        "aud": targets[0],
        "zone": zone_id,
        "sub": claims.get("sub"),
        "sub_type": claims.get("sub_type"),
        "use": claims.get("use"),
        "scopes": scopes,
        "sid": claims.get("sid"),
        "root_sid": claims.get("root_sid"),
        "agent_session_id": claims.get("agent_session_id"),
        "delegation_edge_id": claims.get("delegation_edge_id"),
        "jti": claims.get("jti"),
    }


def sign(claims: MandateClaims, signing_key: str) -> str:
    now = int(time.time())
    payload = {
        "iss": ISSUER,
        "aud": claims.resource,
        "zone": claims.zone,
        "sub": claims.subject,
        "sub_type": claims.subject_type,
        "use": claims.use,
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
    """Verify a mandate the way a Caracal verifier SDK at the upstream boundary would.
    Caracal STS-issued mandates (ES256) verify against the zone JWKS; lab-minted seed
    mandates (HS256) verify against the provider's local signing key."""
    if not token:
        raise VerifyError("missing_token", "no mandate presented")
    try:
        header, payload = jwtmini.peek(token)
    except jwtmini.JwtError as exc:
        raise VerifyError("invalid_token", "mandate malformed") from exc
    if header.get("alg") == "ES256":
        return _verify_caracal(token, payload, str(header.get("kid", "")), require_delegation)
    try:
        claims = jwtmini.decode(token, signing_key)
    except jwtmini.JwtError as exc:
        msg = str(exc)
        if "expired" in msg:
            raise VerifyError("invalid_token", "mandate expired") from exc
        raise VerifyError("invalid_token", "mandate signature invalid") from exc
    if claims.get("iss") != ISSUER:
        raise VerifyError("invalid_token", "unexpected issuer")
    if claims.get("use") not in (USE_RESOURCE, USE_SESSION):
        raise VerifyError("invalid_token", "mandate use claim missing or invalid")
    if claims.get("use") != USE_RESOURCE:
        raise VerifyError("invalid_token", "mandate is not a resource mandate")
    if claims.get("sub_type") not in SUBJECT_TYPES:
        raise VerifyError("invalid_token", "mandate subject type invalid")
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
