"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Non-interactive bootstrap that provisions every Lynx provider, resource, and baseline policy through the Control API.
"""
from __future__ import annotations

import json

from control_client import ControlClient, config_from_env, find_by_identifier, find_by_name
from provision_plan import policy, provider_secret, providers


def ensure_provider(client: ControlClient, entry: dict) -> dict:
    existing = find_by_identifier(client.invoke("identity-provider", "list"), entry["id"])
    if existing:
        print(f"provider exists: {entry['id']}")
        return existing
    config = {}
    secret = provider_secret(entry["id"])
    if secret:
        config["secret"] = secret
    created = client.invoke("identity-provider", "create", {
        "name": entry["name"],
        "identifier": entry["id"],
        "kind": entry["kind"],
        "config": json.dumps(config),
    })
    print(f"provider created: {entry['id']}")
    return created or {"identifier": entry["id"]}


def ensure_resource(client: ControlClient, entry: dict, provider: dict) -> dict:
    existing = find_by_identifier(client.invoke("resource", "list"), entry["resourceIdentifier"])
    if existing:
        print(f"resource exists: {entry['resourceIdentifier']}")
        return existing
    flags = {
        "name": entry["name"],
        "identifier": entry["resourceIdentifier"],
        "scopes": entry["scopes"],
        "upstream-url": entry["upstreamUrl"],
    }
    if provider.get("id"):
        flags["credential-provider-id"] = provider["id"]
    created = client.invoke("resource", "create", flags)
    print(f"resource created: {entry['resourceIdentifier']}")
    return created or {"identifier": entry["resourceIdentifier"]}


def ensure_policy(client: ControlClient, resource_ids: list[str]) -> dict:
    plan = policy(resource_ids)
    existing = find_by_name(client.invoke("policy", "list"), plan["name"])
    if existing:
        print(f"policy exists: {plan['name']}")
        return existing
    created = client.invoke("policy", "create", plan)
    print(f"policy created: {plan['name']}")
    return created or {"name": plan["name"]}


def main() -> None:
    client = ControlClient(config_from_env())
    entries = providers()
    for entry in entries:
        provider = ensure_provider(client, entry)
        ensure_resource(client, entry, provider)
    ensure_policy(client, [entry["resourceIdentifier"] for entry in entries])
    print(f"provisioned {len(entries)} Lynx providers")


if __name__ == "__main__":
    main()
