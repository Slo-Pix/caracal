"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Provisions the Lynx Capital multi-tenant deployment: the managed platform application,
per-tenant DCR applications, domain resources, the policy library and active policy set,
and the per-tenant resource grants.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import tenancy
from control_client import (
    AdminClient,
    ControlClient,
    ControlError,
    config_from_env,
    find_by_identifier,
    find_by_name,
)

ROOT = Path(__file__).resolve().parent.parent
OUTPUTS_PATH = ROOT / "config" / "provisioned.json"


def _id_of(result: object, name: str) -> str:
    if isinstance(result, dict):
        return str(result.get("id") or result.get("identifier") or name)
    return name


def _version_id(result: object) -> str:
    if not isinstance(result, dict):
        return ""
    for key in ("version_id", "active_version_id", "latest_version_id"):
        if result.get(key):
            return str(result[key])
    version = result.get("version") or result.get("latest_version")
    if isinstance(version, dict) and version.get("id"):
        return str(version["id"])
    versions = result.get("versions")
    if isinstance(versions, list) and versions and isinstance(versions[-1], dict):
        return str(versions[-1].get("id", ""))
    return ""


def ensure_managed_app(client: ControlClient, model: tenancy.TenancyModel) -> dict:
    name = model.platform.applicationName
    existing = find_by_name(client.invoke("app", "list"), name)
    if existing:
        print(f"managed app exists: {name}")
        return {"id": existing.get("id"), "client_secret": None}
    created = client.run(tenancy.managed_app_command(model))
    print(f"managed app created: {name}")
    return {"id": _id_of(created, name), "client_secret": (created or {}).get("client_secret") if isinstance(created, dict) else None}


def ensure_resources(client: ControlClient, model: tenancy.TenancyModel) -> None:
    existing = client.invoke("resource", "list")
    for command in tenancy.resource_commands(model):
        identifier = command["flags"]["identifier"]
        if find_by_identifier(existing, identifier):
            print(f"resource exists: {identifier}")
            continue
        client.run(command)
        print(f"resource created: {identifier}")


def ensure_policy_set(client: ControlClient, model: tenancy.TenancyModel) -> None:
    existing_policies = client.invoke("policy", "list")
    version_ids: list[str] = []
    for command in tenancy.policy_commands(model):
        name = command["flags"]["name"]
        found = find_by_name(existing_policies, name)
        result = found if found else client.run(command)
        print(f"policy {'exists' if found else 'created'}: {name}")
        version = _version_id(result)
        if version:
            version_ids.append(version)

    set_name = model.policySet.name
    existing_set = find_by_name(client.invoke("policy-set", "list"), set_name)
    if existing_set:
        set_id = existing_set.get("id")
        print(f"policy-set exists: {set_name}")
    else:
        created = client.invoke("policy-set", "create", {
            "name": set_name,
            "description": model.policySet.description,
        })
        set_id = _id_of(created, set_name)
        print(f"policy-set created: {set_name}")

    if not version_ids:
        print("policy-set: no policy version ids returned; author versions and activate manually")
        return
    version = client.invoke("policy-set", "version", {
        "id": set_id,
        "policy-versions": ",".join(version_ids),
    })
    set_version_id = _version_id(version) or _id_of(version, "")
    client.invoke("policy-set", "activate", {"id": set_id, "version": set_version_id})
    print(f"policy-set activated: {set_name} ({set_version_id})")


def ensure_tenants(client: ControlClient, model: tenancy.TenancyModel) -> dict[str, dict]:
    existing = client.invoke("app", "list")
    tenants: dict[str, dict] = {}
    for tenant in model.tenants:
        found = find_by_name(existing, tenant.dcrApplicationName)
        if found:
            print(f"tenant DCR app exists: {tenant.dcrApplicationName}")
            tenants[tenant.id] = {"id": found.get("id"), "client_secret": None}
            continue
        created = client.run(tenancy.dcr_app_command(tenant))
        print(f"tenant DCR app created: {tenant.dcrApplicationName}")
        tenants[tenant.id] = {
            "id": _id_of(created, tenant.dcrApplicationName),
            "client_secret": (created or {}).get("client_secret") if isinstance(created, dict) else None,
        }
    return tenants


def ensure_grants(model: tenancy.TenancyModel, tenants: dict[str, dict]) -> None:
    try:
        admin = AdminClient.from_env()
    except ControlError as exc:
        print(f"skipping grants ({exc}); set CARACAL_ADMIN_TOKEN to provision grants")
        return
    for spec in tenancy.grant_specs(model):
        application_id = tenants.get(spec["tenant_id"], {}).get("id")
        if not application_id:
            continue
        admin.create_grant(application_id, spec["user_id"], spec["resource_id"], spec["scopes"])
        print(f"grant created: {spec['tenant_id']} -> {spec['resource_id']} {spec['scopes']}")


def write_outputs(managed: dict, tenants: dict[str, dict]) -> None:
    outputs = {
        "managed_application_id": managed.get("id"),
        "managed_application_secret": managed.get("client_secret"),
        "tenants": tenants,
    }
    OUTPUTS_PATH.write_text(json.dumps(outputs, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUTPUTS_PATH.relative_to(ROOT)} (contains one-time secrets; keep it out of version control)")
    if managed.get("client_secret"):
        print("set CARACAL_APPLICATION_ID and CARACAL_APP_CLIENT_SECRET in .env from the values above")


def main() -> None:
    model = tenancy.load_model()
    client = ControlClient(config_from_env())
    managed = ensure_managed_app(client, model)
    ensure_resources(client, model)
    ensure_policy_set(client, model)
    tenants = ensure_tenants(client, model)
    ensure_grants(model, tenants)
    write_outputs(managed, tenants)
    print(f"provisioned platform + {len(model.tenants)} tenants")


if __name__ == "__main__":
    main()
