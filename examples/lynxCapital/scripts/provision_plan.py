"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Provision plan that derives Lynx provider, resource, and policy objects from the partner catalog.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import load_config
from app.services import setup_catalog

POLICY_NAME = "Lynx Capital baseline"
POLICY_DESCRIPTION = "Allow the Lynx Capital application to read and act on its mapped finance resources."
POLICY_SCHEMA_VERSION = "v1"


def providers() -> list[dict]:
    config = load_config()
    entries = setup_catalog.provider_entries(config.providers)
    return [entry for entry in entries if entry["external"]]


def policy(resource_ids: list[str]) -> dict:
    lines = ["package caracal.authz", "", "default allow := false", ""]
    for resource_id in resource_ids:
        lines += [
            "allow if {",
            f'  input.resource == "{resource_id}"',
            '  input.action in {"read", "write"}',
            "}",
            "",
        ]
    return {
        "name": POLICY_NAME,
        "description": POLICY_DESCRIPTION,
        "content": "\n".join(lines),
        "schema-version": POLICY_SCHEMA_VERSION,
    }


def provider_secret(provider_id: str) -> str:
    env_id = setup_catalog.env_id(provider_id)
    for suffix in ("API_KEY", "TOKEN", "CLIENT_SECRET"):
        value = os.environ.get(f"LYNX_PARTNER_{env_id}_{suffix}", "").strip()
        if value:
            return value
    return ""
