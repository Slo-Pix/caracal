"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Lumen Identity domain: internal directory of users, groups, roles, and service accounts.
"""
from __future__ import annotations

from _mock.providerlab.data import generators as gen
from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "lumen-identity"


@base.seeder(ID)
def seed(state: base.State) -> None:
    people = gen.users(ID, 60)
    state.tables["users"] = gen.index_by(people)
    groups = {}
    for u in people:
        for g in u["groups"]:
            groups.setdefault(g, {"id": g, "name": g, "members": []})
            groups[g]["members"].append(u["id"])
    state.tables["groups"] = groups
    state.tables["roles"] = {r: {"id": r, "name": r.title()} for r in
                             ("analyst", "controller", "treasurer", "approver", "auditor", "admin")}
    svc = {}
    for i in range(1, 13):
        rng = gen._rng(ID, "svc", i)
        sid = f"svc-{i:03d}"
        svc[sid] = {"id": sid, "name": f"{rng.choice(('ap','ar','treasury','close','ingest'))}-bot",
                    "scopes": sorted({rng.choice(("read", "write", "approve")) for _ in range(2)}),
                    "active": rng.random() > 0.1}
    state.tables["service_accounts"] = svc


@base.op(ID, "get_user")
def get_user(ctx: Ctx) -> dict:
    ctx.require("userId")
    user = ctx.state.table("users").get(ctx.payload["userId"])
    if user is None:
        raise DomainError(404, "user_not_found", ctx.payload["userId"])
    return user


@base.op(ID, "list_users")
def list_users(ctx: Ctx) -> dict:
    items = list(ctx.state.table("users").values())
    role = ctx.get("role")
    if role:
        items = [u for u in items if u["role"] == role]
    return ctx.paginate(items, size_default=25)


@base.op(ID, "list_groups")
def list_groups(ctx: Ctx) -> dict:
    return ctx.paginate(list(ctx.state.table("groups").values()), size_default=25)


@base.op(ID, "get_service_account")
def get_service_account(ctx: Ctx) -> dict:
    ctx.require("serviceAccountId")
    svc = ctx.state.table("service_accounts").get(ctx.payload["serviceAccountId"])
    if svc is None:
        raise DomainError(404, "service_account_not_found", ctx.payload["serviceAccountId"])
    return svc
