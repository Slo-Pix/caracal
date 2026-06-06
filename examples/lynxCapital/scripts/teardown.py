"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Removes the Lynx baseline policy, resources, and providers provisioned through the Control API.
"""
from __future__ import annotations

from control_client import ControlClient, config_from_env, find_by_identifier, find_by_name
from provision_plan import POLICY_NAME, providers


def remove(client: ControlClient, command: str, item: dict | None, label: str) -> None:
    if not item or not item.get("id"):
        return
    client.invoke(command, "delete", {"id": item["id"]})
    print(f"{label} removed: {item.get('identifier') or item.get('name')}")


def main() -> None:
    client = ControlClient(config_from_env())
    entries = providers()

    policy = find_by_name(client.invoke("policy", "list"), POLICY_NAME)
    remove(client, "policy", policy, "policy")

    resource_list = client.invoke("resource", "list")
    provider_list = client.invoke("identity-provider", "list")
    for entry in entries:
        remove(client, "resource", find_by_identifier(resource_list, entry["resourceIdentifier"]), "resource")
        remove(client, "identity-provider", find_by_identifier(provider_list, entry["id"]), "provider")
    print(f"removed {len(entries)} Lynx providers")


if __name__ == "__main__":
    main()
