"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Minimal JSON-RPC 2.0 MCP handler exposing each MCP provider's operations as tools.
"""
from __future__ import annotations

from typing import Any

from _mock.providerlab import catalog


def _tools(provider: catalog.Provider) -> list[dict]:
    return [
        {
            "name": op,
            "description": f"{provider.brand} operation {op}",
            "inputSchema": {"type": "object", "properties": {"input": {"type": "object"}}},
        }
        for op in provider.operations
    ]


def handle(provider: catalog.Provider, message: dict, principal: dict) -> dict:
    """Dispatch a single JSON-RPC message and return the response envelope."""
    rpc_id = message.get("id")
    method = message.get("method")
    params = message.get("params") or {}

    def ok(result: Any) -> dict:
        return {"jsonrpc": "2.0", "id": rpc_id, "result": result}

    def err(code: int, msg: str) -> dict:
        return {"jsonrpc": "2.0", "id": rpc_id, "error": {"code": code, "message": msg}}

    if method == "initialize":
        return ok({
            "protocolVersion": "2024-11-05",
            "serverInfo": {"name": provider.brand, "version": "1.0"},
            "capabilities": {"tools": {}},
        })
    if method == "tools/list":
        return ok({"tools": _tools(provider)})
    if method == "tools/call":
        name = params.get("name")
        if name not in provider.operations:
            return err(-32601, f"unknown tool: {name}")
        arguments = params.get("arguments") or {}
        payload = {
            "ok": True,
            "tool": name,
            "principal": principal.get("principal"),
            "provider": provider.id,
            "echo": arguments,
        }
        return ok({"content": [{"type": "json", "data": payload}]})
    return err(-32601, f"unknown method: {method}")
