"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Control and Admin API clients that drive Lynx Capital multi-tenant provisioning.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

STS_TOKEN_PATH = "/oauth/2/token"
CONTROL_INVOKE_PATH = "/v1/control/invoke"

# Control scopes the multi-tenant plan requires: applications (managed + DCR), resources,
# identity providers, and the policy and policy-set lifecycle. Grants are not part of the
# Control catalog and use the Admin REST API (see AdminClient) instead.
SCOPES = [
    "control:app:read",
    "control:app:write",
    "control:resource:read",
    "control:resource:write",
    "control:identity-provider:read",
    "control:identity-provider:write",
    "control:policy:read",
    "control:policy:write",
    "control:policy-set:read",
    "control:policy-set:write",
]

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@dataclass
class ControlConfig:
    sts_url: str
    control_url: str
    audience: str
    client_id: str
    client_secret: str
    scopes: list[str] = field(default_factory=lambda: list(SCOPES))


class ControlError(RuntimeError):
    pass


def config_from_env(env: dict[str, str] | None = None) -> ControlConfig:
    env = env or dict(os.environ)
    missing = [
        name
        for name in ("CONTROL_CLIENT_ID", "CONTROL_CLIENT_SECRET")
        if not env.get(name, "").strip()
    ]
    if missing:
        raise ControlError(f"missing required environment values: {', '.join(missing)}")
    scopes = env.get("CONTROL_SCOPES", "").replace(",", " ").split()
    return ControlConfig(
        sts_url=env.get("CARACAL_STS_URL", "http://127.0.0.1:8080").rstrip("/"),
        control_url=env.get("CARACAL_CONTROL_URL", "http://127.0.0.1:8087").rstrip("/"),
        audience=env.get("CONTROL_AUDIENCE", "caracal-control"),
        client_id=env["CONTROL_CLIENT_ID"],
        client_secret=env["CONTROL_CLIENT_SECRET"],
        scopes=scopes or list(SCOPES),
    )


def _post(url: str, body: bytes, headers: dict[str, str]) -> dict:
    request = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise ControlError(f"{url} -> {exc.code}: {detail}") from None
    except urllib.error.URLError as exc:
        raise ControlError(f"{url} unreachable: {exc.reason}") from None
    return json.loads(payload) if payload else {}


def _delete(url: str, headers: dict[str, str]) -> None:
    request = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(request, timeout=20):
            return
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return
        detail = exc.read().decode("utf-8", "replace")
        raise ControlError(f"{url} -> {exc.code}: {detail}") from None
    except urllib.error.URLError as exc:
        raise ControlError(f"{url} unreachable: {exc.reason}") from None


class ControlClient:
    """Exchanges a scoped Control key for a short-lived STS token and invokes the
    zone-bound management catalog (`app`, `resource`, `identity-provider`, `policy`,
    `policy-set`) over `/v1/control/invoke`."""

    def __init__(self, config: ControlConfig):
        self._config = config
        self._token: str | None = None

    def token(self) -> str:
        if self._token:
            return self._token
        form = {
            "grant_type": "client_credentials",
            "application_id": self._config.client_id,
            "client_secret": self._config.client_secret,
            "resource": self._config.audience,
            "scope": " ".join(self._config.scopes),
        }
        result = _post(
            f"{self._config.sts_url}{STS_TOKEN_PATH}",
            urllib.parse.urlencode(form).encode("utf-8"),
            {"content-type": "application/x-www-form-urlencoded"},
        )
        access = result.get("access_token")
        if not access:
            raise ControlError("token exchange returned no access_token")
        self._token = access
        return access

    def invoke(self, command: str, subcommand: str, flags: dict | None = None) -> object:
        body = json.dumps({"command": command, "subcommand": subcommand, "flags": flags or {}}).encode("utf-8")
        result = _post(
            f"{self._config.control_url}{CONTROL_INVOKE_PATH}",
            body,
            {"content-type": "application/json", "authorization": f"Bearer {self.token()}"},
        )
        return result.get("result")

    def run(self, command: dict) -> object:
        """Invoke a plan command of the form built by app.tenancy."""
        return self.invoke(command["command"], command["subcommand"], command.get("flags"))


@dataclass
class AdminConfig:
    api_url: str
    zone_id: str
    admin_token: str


class AdminClient:
    """Creates and revokes resource grants through the Admin REST API. Grants bind a
    tenant's subject to the resource scopes its agents may request; they are an input to
    policy, and they are not reachable through the Control catalog."""

    def __init__(self, config: AdminConfig):
        self._config = config

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "AdminClient":
        env = env or dict(os.environ)
        missing = [
            name
            for name in ("CARACAL_ZONE_ID", "CARACAL_ADMIN_TOKEN")
            if not env.get(name, "").strip()
        ]
        if missing:
            raise ControlError(f"missing required environment values: {', '.join(missing)}")
        return cls(AdminConfig(
            api_url=env.get("CARACAL_API_URL", "http://127.0.0.1:8084").rstrip("/"),
            zone_id=env["CARACAL_ZONE_ID"],
            admin_token=env["CARACAL_ADMIN_TOKEN"],
        ))

    def _headers(self) -> dict[str, str]:
        return {"content-type": "application/json", "authorization": f"Bearer {self._config.admin_token}"}

    def create_grant(self, application_id: str, user_id: str, resource_id: str, scopes: list[str]) -> dict:
        body = json.dumps({
            "application_id": application_id,
            "user_id": user_id,
            "resource_id": resource_id,
            "scopes": scopes,
        }).encode("utf-8")
        return _post(
            f"{self._config.api_url}/v1/zones/{self._config.zone_id}/grants",
            body,
            self._headers(),
        )

    def revoke_grant(self, grant_id: str) -> None:
        _delete(
            f"{self._config.api_url}/v1/zones/{self._config.zone_id}/grants/{grant_id}",
            self._headers(),
        )


def find_by_identifier(items: object, identifier: str) -> dict | None:
    if isinstance(items, list):
        return next((item for item in items if isinstance(item, dict) and item.get("identifier") == identifier), None)
    return None


def find_by_name(items: object, name: str) -> dict | None:
    if isinstance(items, list):
        return next((item for item in items if isinstance(item, dict) and item.get("name") == name), None)
    return None
