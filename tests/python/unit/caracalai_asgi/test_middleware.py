# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# CaracalASGIAuth middleware unit tests.

from __future__ import annotations

import json
import os
import unittest
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parents[3] / "shared" / "test-utils" / "python"))

from caracal_test_tokens import mint_es256_token
from caracalai_asgi import CaracalASGIAuth
from caracalai_identity import verify
from caracalai_revocation import InMemoryRevocationStore


class StubCache:
    def __init__(self) -> None:
        self.keys: list[dict[str, object]] = []

    async def get_keys(self, issuer: str, zone_id: str) -> list[dict[str, object]]:
        return self.keys


class Recorder:
    def __init__(self) -> None:
        self.scopes: list[dict] = []

    async def __call__(self, scope, receive, send) -> None:
        self.scopes.append(scope)
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": b"{}"})


def http_scope(path: str = "/", token: str | None = None, kind: str = "http") -> dict:
    headers = []
    if token is not None:
        headers.append((b"authorization", f"Bearer {token}".encode()))
    return {"type": kind, "path": path, "headers": headers}


async def call(middleware, scope) -> tuple[int | None, dict | None, list[dict]]:
    sent: list[dict] = []

    async def receive() -> dict:
        return {"type": "http.request"}

    async def send(message: dict) -> None:
        sent.append(message)

    await middleware(scope, receive, send)
    status = next(
        (m["status"] for m in sent if m["type"] == "http.response.start"), None
    )
    body = next(
        (
            json.loads(m["body"].decode())
            for m in sent
            if m["type"] == "http.response.body" and m.get("body")
        ),
        None,
    )
    return status, body, sent


class CaracalASGIAuthTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.cache = StubCache()
        self.original_cache = verify._cache
        verify._cache = self.cache
        self.app = Recorder()
        self.store = InMemoryRevocationStore()

    async def asyncTearDown(self) -> None:
        verify._cache = self.original_cache

    def middleware(self, **kwargs) -> CaracalASGIAuth:
        kwargs.setdefault("audience", "resource://api")
        kwargs.setdefault("revocations", self.store)
        kwargs.setdefault("issuer", "https://sts.example.com")
        kwargs.setdefault("expected_zone_id", "zone1")
        return CaracalASGIAuth(self.app, **kwargs)

    async def test_missing_token_rejected_as_401(self) -> None:
        status, body, _ = await call(self.middleware(), http_scope())
        self.assertEqual(status, 401)
        self.assertEqual(body["error"], "missing_token")
        self.assertEqual(self.app.scopes, [])

    async def test_verified_request_reaches_app_with_claims(self) -> None:
        token, jwk = mint_es256_token(scopes=("read",))
        self.cache.keys = [jwk]
        status, _, _ = await call(
            self.middleware(required_scopes=["read"]), http_scope(token=token)
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(self.app.scopes), 1)
        principal = self.app.scopes[0]["state"]["caracal"]
        self.assertEqual(principal.zone_id, "zone1")
        self.assertIn("read", principal.scope)

    async def test_insufficient_scope_rejected_as_403(self) -> None:
        token, jwk = mint_es256_token(scopes=("read",))
        self.cache.keys = [jwk]
        status, body, _ = await call(
            self.middleware(required_scopes=["write"]), http_scope(token=token)
        )
        self.assertEqual(status, 403)
        self.assertEqual(body["error"], "insufficient_scope")
        self.assertEqual(self.app.scopes, [])

    async def test_route_overrides_apply_by_longest_prefix(self) -> None:
        token, jwk = mint_es256_token(scopes=("read",))
        self.cache.keys = [jwk]
        middleware = self.middleware(
            routes={"/payouts": {"required_scopes": ["write"]}}
        )
        status, body, _ = await call(
            middleware, http_scope("/payouts/create", token=token)
        )
        self.assertEqual(status, 403)
        self.assertEqual(body["error"], "insufficient_scope")
        status, _, _ = await call(middleware, http_scope("/balances", token=token))
        self.assertEqual(status, 200)

    async def test_revoked_session_rejected(self) -> None:
        token, jwk = mint_es256_token()
        self.cache.keys = [jwk]
        self.store.mark_revoked("sid1")
        status, body, _ = await call(self.middleware(), http_scope(token=token))
        self.assertEqual(status, 401)
        self.assertEqual(body["error"], "session_revoked")

    async def test_exclude_prefix_skips_verification(self) -> None:
        status, _, _ = await call(
            self.middleware(exclude=["/healthz"]), http_scope("/healthz")
        )
        self.assertEqual(status, 200)
        self.assertEqual(len(self.app.scopes), 1)

    async def test_websocket_rejected_with_policy_close(self) -> None:
        _, _, sent = await call(self.middleware(), http_scope(kind="websocket"))
        self.assertEqual(sent, [{"type": "websocket.close", "code": 1008}])

    async def test_lifespan_passes_through(self) -> None:
        scope = {"type": "lifespan"}
        await call(self.middleware(), scope)
        self.assertEqual(self.app.scopes, [scope])

    async def test_issuer_defaults_to_sts_env(self) -> None:
        token, jwk = mint_es256_token()
        self.cache.keys = [jwk]
        os.environ["CARACAL_STS_URL"] = "https://sts.example.com/"
        try:
            middleware = CaracalASGIAuth(
                self.app,
                audience="resource://api",
                revocations=self.store,
                expected_zone_id="zone1",
            )
        finally:
            del os.environ["CARACAL_STS_URL"]
        status, _, _ = await call(middleware, http_scope(token=token))
        self.assertEqual(status, 200)

    async def test_missing_issuer_fails_closed_at_construction(self) -> None:
        os.environ.pop("CARACAL_STS_URL", None)
        with self.assertRaises(ValueError):
            CaracalASGIAuth(self.app, audience="resource://api", revocations=self.store)


if __name__ == "__main__":
    unittest.main()
