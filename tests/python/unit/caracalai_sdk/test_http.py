"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Unit tests for CaracalContextASGIMiddleware non-HTTP scope passthrough.
"""

from __future__ import annotations

import unittest

from caracalai_sdk.http import CaracalContextASGIMiddleware


class CaracalContextASGIMiddlewareTests(unittest.IsolatedAsyncioTestCase):
    async def test_passes_non_http_scope_to_inner_app(self) -> None:
        received: list[dict] = []

        async def app(scope, receive, send):
            received.append(scope)

        middleware = CaracalContextASGIMiddleware(app, None)  # type: ignore[arg-type]
        scope = {"type": "lifespan"}
        await middleware(scope, None, None)

        self.assertEqual(received, [scope])

    async def test_passes_websocket_scope_to_inner_app(self) -> None:
        received: list[dict] = []

        async def app(scope, receive, send):
            received.append(scope)

        middleware = CaracalContextASGIMiddleware(app, None)  # type: ignore[arg-type]
        scope = {"type": "websocket"}
        await middleware(scope, None, None)

        self.assertEqual(received, [scope])

    async def test_reraises_runtime_errors_unrelated_to_missing_token(self) -> None:
        class BrokenCaracal:
            def bind_from_headers(self, _headers, *, allow_root=False):
                class Manager:
                    async def __aenter__(self):
                        raise RuntimeError("database unavailable")

                    async def __aexit__(self, _exc_type, _exc, _tb):
                        return False

                return Manager()

        async def app(_scope, _receive, _send):
            raise AssertionError("app should not run")

        middleware = CaracalContextASGIMiddleware(app, BrokenCaracal())  # type: ignore[arg-type]
        scope = {"type": "http", "headers": [(b"authorization", b"Bearer tok")]}
        with self.assertRaisesRegex(RuntimeError, "database unavailable"):
            await middleware(scope, None, None)


if __name__ == "__main__":
    unittest.main()
