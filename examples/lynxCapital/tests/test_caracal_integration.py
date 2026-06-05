"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Offline tests exercising the real published Caracal SDK seam against env config without a running control plane.
"""
from __future__ import annotations

import asyncio
import importlib

import pytest

import app.caracal as caracal


_ENV = {
    "CARACAL_ZONE_ID": "zone_demo",
    "CARACAL_APPLICATION_ID": "app_demo",
    "CARACAL_SUBJECT_TOKEN": "tok_static_demo",
    "CARACAL_GATEWAY_URL": "http://localhost:8081",
    "CARACAL_RESOURCES": "meridian-pay=http://localhost:9401",
}


@pytest.fixture()
def configured(monkeypatch):
    """Configure Caracal with a static subject token so the client builds without
    any STS/coordinator network round-trip, then dispose the client afterwards."""
    for key, value in _ENV.items():
        monkeypatch.setenv(key, value)
    importlib.reload(caracal)
    yield caracal
    asyncio.run(caracal.aclose())
    importlib.reload(caracal)


def test_disabled_without_env(monkeypatch):
    for key in _ENV:
        monkeypatch.delenv(key, raising=False)
    importlib.reload(caracal)
    assert caracal.enabled() is False
    assert caracal.runtime() is None
    assert caracal.context_middleware() is None
    assert caracal.spawn() is None


def test_enabled_and_client_builds(configured):
    assert configured.enabled() is True
    client = configured.runtime()
    assert client is not None
    assert type(client).__name__ == "Caracal"


def test_gateway_request_routing(configured):
    client = configured.runtime()
    request = client.gateway_request("meridian-pay", "/api/get_balance")
    assert request.url == "http://localhost:8081/api/get_balance"
    assert request.headers["X-Caracal-Resource"] == "meridian-pay"


def test_envelope_fails_closed_without_context(configured):
    client = configured.runtime()
    with pytest.raises(RuntimeError):
        client.headers()


def test_envelope_within_bound_context(configured):
    client = configured.runtime()

    async def run() -> dict:
        async with client.bind_from_headers(
            {"authorization": "Bearer tok_static_demo"}, allow_root=True
        ):
            return client.headers(allow_root=True)

    headers = asyncio.run(run())
    assert headers["authorization"] == "Bearer tok_static_demo"


def test_verifier_rejects_invalid_token(configured):
    with pytest.raises(Exception):
        configured.verify_internal(
            zone_id="zone_demo", audience="lumen-identity", required_scopes=["read"]
        )
