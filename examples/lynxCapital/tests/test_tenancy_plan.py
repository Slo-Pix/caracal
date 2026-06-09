"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Unit tests for the Lynx Capital multi-tenant provisioning-plan builders and tenant model.
"""
from __future__ import annotations

from app import tenancy


def test_model_and_manifest_load():
    model = tenancy.load_model()
    assert model.platform.applicationName == "lynx-platform"
    assert {t.id for t in model.tenants} == {"aurora", "borealis"}
    assert {r.identifier for r in model.resources} == {
        "resource://portfolio",
        "resource://research",
        "resource://compliance",
    }
    manifest = tenancy.load_manifest()
    assert manifest.capabilities_for("portfolio") == ["portfolio-read", "portfolio-write", "research-read"]


def test_managed_and_dcr_commands():
    model = tenancy.load_model()
    managed = tenancy.managed_app_command(model)
    assert managed == {"command": "app", "subcommand": "create", "flags": {"name": "lynx-platform"}}

    dcr = tenancy.dcr_app_command(model.tenants[0])
    assert dcr["subcommand"] == "dcr"
    assert dcr["flags"]["name"] == "tenant-aurora"
    assert dcr["flags"]["expires-in"] <= 3600


def test_resource_and_policy_commands_cover_the_library():
    model = tenancy.load_model()
    resources = tenancy.resource_commands(model)
    assert {c["flags"]["identifier"] for c in resources} == {
        "resource://portfolio",
        "resource://research",
        "resource://compliance",
    }

    policies = tenancy.policy_commands(model)
    names = [c["flags"]["name"] for c in policies]
    assert names[0] == "00-base", "base policy must be authored first"
    for required in ("portfolio-write", "delegated-advisor", "emergency-access"):
        assert required in names
    assert all("package caracal.authz" in c["flags"]["content"] for c in policies)


def test_agent_labels_and_role_scopes_are_least_privilege():
    labels = tenancy.agent_labels("aurora", "portfolio")
    assert labels[0] == "tenant:aurora"
    assert "portfolio-write" in labels

    scopes = tenancy.role_scopes("portfolio")
    assert "portfolio:write" in scopes
    assert "compliance:admin" not in scopes


def test_grant_specs_are_per_tenant_and_scoped():
    model = tenancy.load_model()
    specs = tenancy.grant_specs(model)
    tenants = {s["tenant_id"] for s in specs}
    assert tenants == {"aurora", "borealis"}

    aurora_portfolio = [
        s for s in specs if s["tenant_id"] == "aurora" and s["resource_identifier"] == "resource://portfolio"
    ]
    assert aurora_portfolio, "aurora must hold a portfolio grant"
    assert "portfolio:write" in aurora_portfolio[0]["scopes"]

    for spec in specs:
        assert spec["user_id"].startswith("customer:")
        assert spec["scopes"] == sorted(spec["scopes"])
