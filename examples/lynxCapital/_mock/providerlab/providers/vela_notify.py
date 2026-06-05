"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Vela Notify domain: transactional email and SMS dispatch with delivery status and reusable templates.
"""
from __future__ import annotations

from _mock.providerlab.providers import base
from _mock.providerlab.providers.base import Ctx, DomainError

ID = "vela-notify"

_TEMPLATES = {
    "remittance_advice": {"id": "remittance_advice", "channels": ("email",), "vars": ("vendor", "amount", "ref")},
    "dunning_reminder": {"id": "dunning_reminder", "channels": ("email", "sms"), "vars": ("customer", "balance", "dueDate")},
    "payment_confirmation": {"id": "payment_confirmation", "channels": ("email", "sms"), "vars": ("payee", "amount")},
}


@base.seeder(ID)
def seed(state: base.State) -> None:
    state.tables["messages"] = {}
    state.tables["templates"] = dict(_TEMPLATES)


@base.op(ID, "send_message")
def send_message(ctx: Ctx) -> dict:
    ctx.require("channel", "to", "template")
    if ctx.payload["channel"] not in ("email", "sms"):
        raise DomainError(422, "invalid_channel", "channel must be email or sms")
    template = ctx.state.table("templates").get(ctx.payload["template"])
    if template is None:
        raise DomainError(404, "template_not_found", ctx.payload["template"])
    if ctx.payload["channel"] not in template["channels"]:
        raise DomainError(422, "channel_unsupported", "template does not support this channel")
    message = {"messageId": base.new_id("msg"), "channel": ctx.payload["channel"],
               "to": ctx.payload["to"], "template": ctx.payload["template"], "status": "queued"}
    ctx.state.table("messages")[message["messageId"]] = message
    return message


@base.op(ID, "get_message")
def get_message(ctx: Ctx) -> dict:
    ctx.require("messageId")
    message = ctx.state.table("messages").get(ctx.payload["messageId"])
    if message is None:
        raise DomainError(404, "message_not_found", ctx.payload["messageId"])
    if message["status"] == "queued":
        message["status"] = "delivered"
    return message


@base.op(ID, "list_templates")
def list_templates(ctx: Ctx) -> dict:
    return {"items": list(ctx.state.table("templates").values())}
