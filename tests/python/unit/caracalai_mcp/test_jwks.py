# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Python JWKS cache unit tests for issuer lookup and TTL behavior.

from __future__ import annotations

import unittest

from caracalai_mcp import jwks


class FakeResponse:
    def __init__(self, body: dict[str, object]) -> None:
        self.body = body

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self.body


class FakeAsyncClient:
    urls: list[str] = []
    body: dict[str, object] = {"keys": [{"kid": "kid1"}]}

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    async def get(self, url: str) -> FakeResponse:
        self.urls.append(url)
        return FakeResponse(self.body)


class JwksCacheTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        FakeAsyncClient.urls = []
        FakeAsyncClient.body = {"keys": [{"kid": "kid1"}]}
        self.original_client = jwks.httpx.AsyncClient
        jwks.httpx.AsyncClient = FakeAsyncClient

    async def asyncTearDown(self) -> None:
        jwks.httpx.AsyncClient = self.original_client

    async def test_fetches_jwks_from_standard_issuer_path(self) -> None:
        cache = jwks.JwksCache()

        keys = await cache.get_keys("https://issuer.example/")

        self.assertEqual(keys, [{"kid": "kid1"}])
        self.assertEqual(FakeAsyncClient.urls, ["https://issuer.example/.well-known/jwks.json"])

    async def test_reuses_cached_keys_for_same_issuer(self) -> None:
        cache = jwks.JwksCache()

        first = await cache.get_keys("https://issuer.example")
        FakeAsyncClient.body = {"keys": [{"kid": "kid2"}]}
        second = await cache.get_keys("https://issuer.example")

        self.assertIs(first, second)
        self.assertEqual(second, [{"kid": "kid1"}])
        self.assertEqual(len(FakeAsyncClient.urls), 1)


if __name__ == "__main__":
    unittest.main()