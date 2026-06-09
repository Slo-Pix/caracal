"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Identity-model loader and Control provisioning-plan builders for the Lynx Capital platform.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import yaml
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TENANCY_PATH = ROOT / "config" / "tenancy.yaml"
DEFAULT_POLICIES_DIR = ROOT / "policies"
SCHEMA_VERSION = "2026-05-20"


class ProviderSpec(BaseModel):
    identifier: str
    name: str
    kind: str = "caracal_mandate"
    config: dict = {}


class ResourceSpec(BaseModel):
    identifier: str
    resourceId: str
    name: str
    scopes: list[str]
    upstreamEnv: str

    def upstream_url(self) -> str:
        return os.environ.get(self.upstreamEnv, "").rstrip("/")


class ApplicationSpec(BaseModel):
    id: str
    applicationName: str
    controlKeyName: str = ""
    provider: ProviderSpec
    resource: ResourceSpec
    agents: list[str]


class PolicySetSpec(BaseModel):
    name: str
    description: str = ""
    schemaVersion: str = SCHEMA_VERSION


class CustomerSpec(BaseModel):
    id: str
    name: str
    subject: str
    plan: str = "growth"


class TenancyModel(BaseModel):
    applications: list[ApplicationSpec]
    policySet: PolicySetSpec
    customers: list[CustomerSpec]

    @property
    def providers(self) -> list[ProviderSpec]:
        return [app.provider for app in self.applications]

    @property
    def resources(self) -> list[ResourceSpec]:
        return [app.resource for app in self.applications]

    def application(self, application_id: str) -> ApplicationSpec:
        for spec in self.applications:
            if spec.id == application_id or spec.applicationName == application_id:
                return spec
        raise KeyError(f"unknown application: {application_id!r}")

    def application_for_resource(self, identifier: str) -> ApplicationSpec:
        for spec in self.applications:
            if spec.resource.identifier == identifier or spec.resource.resourceId == identifier:
                return spec
        raise KeyError(f"no application owns resource: {identifier!r}")

    def resource(self, identifier: str) -> ResourceSpec:
        for spec in self.applications:
            if spec.resource.identifier == identifier or spec.resource.resourceId == identifier:
                return spec.resource
        raise KeyError(f"unknown resource: {identifier!r}")

    def customer(self, customer_id: str) -> CustomerSpec:
        for spec in self.customers:
            if spec.id == customer_id:
                return spec
        raise KeyError(f"unknown customer: {customer_id!r}")


class PolicyManifest(BaseModel):
    roles: dict[str, list[str]]
    policies: list[dict]

    def capabilities_for(self, role: str) -> list[str]:
        if role not in self.roles:
            raise KeyError(f"unknown role: {role!r}")
        return list(self.roles[role])


_model: TenancyModel | None = None
_manifest: PolicyManifest | None = None


def load_model(path: str | os.PathLike[str] | None = None) -> TenancyModel:
    global _model
    if _model is not None and path is None:
        return _model
    target = Path(path) if path is not None else Path(os.environ.get("LYNX_TENANCY", DEFAULT_TENANCY_PATH))
    data = yaml.safe_load(target.read_text(encoding="utf-8"))
    model = TenancyModel.model_validate(data)
    if path is None:
        _model = model
    return model


def load_manifest(path: str | os.PathLike[str] | None = None) -> PolicyManifest:
    global _manifest
    if _manifest is not None and path is None:
        return _manifest
    target = Path(path) if path is not None else DEFAULT_POLICIES_DIR / "manifest.json"
    data = json.loads(target.read_text(encoding="utf-8"))
    manifest = PolicyManifest.model_validate(data)
    if path is None:
        _manifest = manifest
    return manifest


def agent_labels(role: str, manifest: PolicyManifest | None = None) -> list[str]:
    """The Caracal agent-session labels for a role: every capability label the role's
    policies key on. Labels are descriptive authority hints the policy set reads; the
    customer the agent acts for travels in the subject and spawn metadata, not in a label."""
    manifest = manifest or load_manifest()
    return list(manifest.capabilities_for(role))


def role_scopes(
    role: str,
    *,
    application: "ApplicationSpec | str | None" = None,
    model: TenancyModel | None = None,
    manifest: PolicyManifest | None = None,
) -> list[str]:
    """The least-privilege scopes a role's agent may hold, used to narrow a spawned agent's
    delegation edge. The union of the role's capability grants is intersected with the scopes
    that actually exist; when an application is given it is further intersected with that
    application's resource scopes, so an agent spawned under a service application can never
    obtain authority over another service's resource even if its role is cross-domain."""
    model = model or load_model()
    manifest = manifest or load_manifest()
    known = {scope for resource in model.resources for scope in resource.scopes}
    if application is not None:
        app = application if isinstance(application, ApplicationSpec) else model.application(application)
        known = set(app.resource.scopes)
    scopes: set[str] = set()
    for capability in manifest.capabilities_for(role):
        for entry in manifest.policies:
            if entry.get("capability") == capability:
                scopes.update(set(entry.get("grants", [])) & known)
    return sorted(scopes)


def customer_metadata(customer_id: str, role: str, application_id: str | None = None) -> dict[str, str]:
    """The spawn metadata that correlates an agent session to the customer it serves, the
    role it runs, and the service application it runs under. The policy set reads the customer
    from the subject claims; this metadata is the audit-trail correlation key."""
    metadata = {"customer_id": customer_id, "role": role}
    if application_id is not None:
        metadata["application_id"] = application_id
    return metadata


def application_commands(model: TenancyModel) -> list[dict]:
    """Control invoke payloads that create each durable managed service application. Managed
    applications are normally created once in Console; this is provided for scripted bootstrap
    of a fresh zone."""
    return [
        {"command": "app", "subcommand": "create", "flags": {"name": app.applicationName}}
        for app in model.applications
    ]


def provider_commands(model: TenancyModel) -> list[dict]:
    """Control invoke payloads that register each application's upstream credential provider."""
    return [
        {
            "command": "identity-provider",
            "subcommand": "create",
            "flags": {
                "name": app.provider.name,
                "identifier": app.provider.identifier,
                "kind": app.provider.kind,
                "config": json.dumps(app.provider.config),
            },
        }
        for app in model.applications
    ]


def resource_commands(
    model: TenancyModel,
    provider_ids: dict[str, str] | None = None,
    application_ids: dict[str, str] | None = None,
) -> list[dict]:
    """Control invoke payloads that register each Lynx domain resource and bind it to its
    application's trust boundary. provider_ids maps a provider identifier to the id the control
    plane returned; application_ids maps an application id to the gateway application id, so the
    gateway only honours that application's mandate for the resource."""
    provider_ids = provider_ids or {}
    application_ids = application_ids or {}
    commands: list[dict] = []
    for app in model.applications:
        spec = app.resource
        flags: dict[str, object] = {
            "name": spec.name,
            "identifier": spec.identifier,
            "scopes": spec.scopes,
        }
        upstream = spec.upstream_url()
        if upstream:
            flags["upstream-url"] = upstream
        provider_id = provider_ids.get(app.provider.identifier)
        if provider_id:
            flags["credential-provider-id"] = provider_id
        application_id = application_ids.get(app.id)
        if application_id:
            flags["gateway-application-id"] = application_id
        commands.append({"command": "resource", "subcommand": "create", "flags": flags})
    return commands


def policy_files(policies_dir: str | os.PathLike[str] | None = None) -> list[tuple[str, str]]:
    """The policy library as ordered (name, content) pairs. 00-base is always first so the
    decision contract is present before the scenario policies that contribute to it."""
    directory = Path(policies_dir) if policies_dir is not None else DEFAULT_POLICIES_DIR
    files = sorted(p for p in directory.glob("*.rego") if not p.name.endswith("_test.rego"))
    return [(p.stem, p.read_text(encoding="utf-8")) for p in files]


def policy_commands(model: TenancyModel, policies_dir: str | os.PathLike[str] | None = None) -> list[dict]:
    """Control invoke payloads that author every policy in the library."""
    return [
        {
            "command": "policy",
            "subcommand": "create",
            "flags": {"name": name, "content": content, "schema-version": model.policySet.schemaVersion},
        }
        for name, content in policy_files(policies_dir)
    ]
