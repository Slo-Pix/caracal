"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Boundary tests asserting Caracal envelope propagation, scope derivation,
delegated-spawn constraints, header injection, and webhook secret enforcement.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest

from app import caracal as caracal_module
from app.agents.roles import ROLES
from app.api import hooks
from app.services.transport.sse import SseConsumer


def test_scopes_for_renders_role_region_template():
    scopes = caracal_module._scopes_for("invoice-intake", "US", None)
    assert scopes == ["invoice-intake:US:invoice-batch:{region}"]


def test_scopes_for_uses_explicit_scope():
    scopes = caracal_module._scopes_for("payment-execution", "EU", "payment:execute:wire")
    assert scopes == ["payment-execution:EU:payment:execute:wire"]


def test_scopes_for_unknown_role_falls_back_to_role_only():
    scopes = caracal_module._scopes_for("nonexistent", None, None)
    assert scopes == ["nonexistent"]


def test_constraints_for_carries_allowed_tools():
    c = caracal_module._constraints_for("invoice-intake")
    assert c.resources == list(ROLES["invoice-intake"].allowed_tools)
    assert c.max_depth == 4


def test_sse_headers_include_caracal_envelope():
    consumer = SseConsumer(
        provider="fx-rates",
        url="http://127.0.0.1:0",
        auth_header="X-API-Key",
        auth_env="LYNX_FX_KEY_TEST",
        on_event=lambda *a: None,
    )
    fake = {"X-Caracal-Subject": "tok-abc", "X-Caracal-Hop": "1"}
    with patch.object(caracal_module, "headers", return_value=fake):
        h = consumer._headers()
    assert h["X-Caracal-Subject"] == "tok-abc"
    assert h["X-Caracal-Hop"] == "1"
    assert h["Accept"] == "text/event-stream"


def test_sse_caracal_headers_do_not_overwrite_explicit():
    consumer = SseConsumer(
        provider="fx-rates",
        url="http://127.0.0.1:0",
        auth_header="Accept",
        auth_env="LYNX_FX_KEY_TEST",
        on_event=lambda *a: None,
    )
    with patch.object(caracal_module, "headers", return_value={"Accept": "x-replaced"}):
        h = consumer._headers()
    assert h["Accept"] == "text/event-stream"


def test_required_secret_envs_covers_all_providers():
    envs = hooks.required_secret_envs()
    assert "LYNX_MERCURY_HOOK_SECRET" in envs
    assert "LYNX_TREASURY_HOOK_SECRET" in envs
    assert len(envs) == len(hooks._SECRET_ENV)


def test_webhook_secret_missing_raises(monkeypatch):
    monkeypatch.delenv("LYNX_MERCURY_HOOK_SECRET", raising=False)
    with pytest.raises(Exception) as exc:
        hooks._secret("mercury-bank")
    assert exc.value.status_code == 503


def test_webhook_unknown_provider_raises():
    with pytest.raises(Exception) as exc:
        hooks._secret("does-not-exist")
    assert exc.value.status_code == 404


def test_dedup_marks_repeat_event_id():
    d = hooks._Dedup()
    assert d.seen("evt-1") is False
    assert d.seen("evt-1") is True
    assert d.seen("evt-2") is False


def test_registry_required_env_raises_when_unset(monkeypatch):
    from app.services import registry

    monkeypatch.delenv("LYNX_MERCURY_URL", raising=False)
    registry.reset()
    with pytest.raises(RuntimeError, match="provider env var not set: LYNX_MERCURY_URL"):
        registry._build_rest("mercury-bank")


def test_rest_transport_sets_explicit_caracal_resource(monkeypatch):
    from app.services.transport.rest import AuthSpec, RestClient

    class FakeHttp:
        def __init__(self):
            self.headers = {}

        def request(self, _method, _path, *, json, headers):
            self.headers = headers
            return type("Response", (), {"status_code": 200, "content": b"{}", "json": lambda _self: {}})()

        def close(self):
            return None

    monkeypatch.setenv("LYNX_MERCURY_KEY", "local-mercury-bank-key")
    client = RestClient(
        "mercury-bank",
        "http://127.0.0.1:8800",
        AuthSpec("Authorization", "Bearer ", "LYNX_MERCURY_KEY"),
    )
    fake = FakeHttp()
    client._http = fake
    client._do("POST", "/v1/accounts/balance", json={}, headers={}, attempt=1)
    assert fake.headers["X-Caracal-Resource"] == "lynx/mercury-bank"
