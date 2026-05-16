"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Python OAuth client tests for cache isolation and STS response validation.
"""

from __future__ import annotations

import unittest

import httpx

from caracalai_oauth import ExchangeOptions, InteractionRequiredError, OAuthClient


class OAuthClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_exchange_does_not_share_cache_across_client_secrets(self) -> None:
        requests: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            form = dict(part.split("=", 1) for part in request.content.decode().split("&"))
            secret = form.get("client_secret", "")
            requests.append(secret)
            return httpx.Response(
                200,
                json={"access_token": f"token-{secret}", "token_type": "Bearer", "expires_in": 3600},
                headers={"content-type": "application/json"},
            )

        client = OAuthClient(
            "https://sts.example.com",
            "zone1",
            "app1",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        first = await client.exchange("subject", "resource://api", ExchangeOptions(client_secret="a"))
        second = await client.exchange("subject", "resource://api", ExchangeOptions(client_secret="b"))
        third = await client.exchange("subject", "resource://api", ExchangeOptions(client_secret="a"))

        self.assertEqual(first.access_token, "token-a")
        self.assertEqual(second.access_token, "token-b")
        self.assertEqual(third.access_token, "token-a")
        self.assertEqual(requests, ["a", "b"])

    async def test_exchange_rejects_malformed_success_response(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"access_token": "", "token_type": "Bearer", "expires_in": 3600},
                headers={"content-type": "application/json"},
            )

        client = OAuthClient(
            "https://sts.example.com",
            "zone1",
            "app1",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        with self.assertRaisesRegex(RuntimeError, "access_token is required"):
            await client.exchange("subject", "resource://api")

    async def test_exchange_rejects_boolean_expiry(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={"access_token": "token1", "token_type": "Bearer", "expires_in": True},
                headers={"content-type": "application/json"},
            )

        client = OAuthClient(
            "https://sts.example.com",
            "zone1",
            "app1",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        with self.assertRaisesRegex(RuntimeError, "expires_in must be a positive integer"):
            await client.exchange("subject", "resource://api")

    async def test_exchange_returns_interaction_required_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                403,
                json={
                    "error": "interaction_required",
                    "error_description": "step up",
                    "challenge_id": "challenge1",
                    "acr_values": "urn:mfa",
                },
                headers={"content-type": "application/json"},
            )

        client = OAuthClient(
            "https://sts.example.com",
            "zone1",
            "app1",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        with self.assertRaises(InteractionRequiredError) as raised:
            await client.exchange("subject", "resource://api")
        self.assertEqual(raised.exception.challenge_id, "challenge1")
        self.assertEqual(raised.exception.resource, "resource://api")

    async def test_exchange_retries_once_after_unauthorized(self) -> None:
        requests = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal requests
            requests += 1
            if requests == 1:
                return httpx.Response(
                    401,
                    json={"error_description": "expired client credential"},
                    headers={"content-type": "application/json"},
                )
            return httpx.Response(
                200,
                json={"access_token": "fresh", "token_type": "Bearer", "expires_in": 3600},
                headers={"content-type": "application/json"},
            )

        client = OAuthClient(
            "https://sts.example.com",
            "zone1",
            "app1",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        token = await client.exchange("subject", "resource://api", ExchangeOptions(retries=0))

        self.assertEqual(token.access_token, "fresh")
        self.assertEqual(requests, 2)


if __name__ == "__main__":
    unittest.main()
