"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Generic ASGI middleware that extracts the envelope and binds CaracalContext per request.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from collections.abc import Awaitable, Callable

if TYPE_CHECKING:
    from .client import Caracal


Scope = dict[str, Any]
Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


class CaracalASGIMiddleware:
    """ASGI middleware (Starlette/FastAPI/raw ASGI) that binds a Caracal
    context for every HTTP request scope from inbound envelope headers."""

    def __init__(self, app: ASGIApp, caracal: Caracal, *, allow_root: bool = False) -> None:
        self.app = app
        self.caracal = caracal
        self.allow_root = allow_root

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        raw = scope.get("headers", [])
        headers: dict[str, str] = {}
        for k, v in raw:
            headers[k.decode("latin-1")] = v.decode("latin-1")
        try:
            async with self.caracal.bind_from_headers(headers, allow_root=self.allow_root):
                await self.app(scope, receive, send)
        except RuntimeError as err:
            if "missing a bearer token" not in str(err):
                raise
            await send({
                "type": "http.response.start",
                "status": 401,
                "headers": [(b"content-type", b"application/json")],
            })
            await send({
                "type": "http.response.body",
                "body": b'{"error":"missing_token","message":"Missing bearer token"}',
            })
