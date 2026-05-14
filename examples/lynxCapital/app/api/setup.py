"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Setup validation endpoint confirming OpenAI credentials and the Caracal stack are reachable.
"""
from __future__ import annotations

import os

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()

_CARACAL_ENV = (
    "CARACAL_COORDINATOR_URL",
    "CARACAL_GATEWAY_URL",
    "CARACAL_STS_URL",
)


async def _ping(url: str) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=2.0) as http:
            r = await http.get(url)
        return (r.status_code < 500, f"{url} → {r.status_code}")
    except Exception as exc:
        return (False, f"{url} unreachable: {exc.__class__.__name__}")


@router.get("/validate")
async def validate_setup():
    steps: list[dict] = []

    api_key = os.environ.get("OPENAI_API_KEY", "")
    steps.append({
        "id": "openai_key",
        "label": "OPENAI_API_KEY set",
        "ok": bool(api_key),
        "detail": "Found in environment." if api_key
                  else "Missing — add it to .env or your shell.",
    })

    missing = [k for k in _CARACAL_ENV if not os.environ.get(k)]
    steps.append({
        "id": "caracal_env",
        "label": "Caracal env vars set",
        "ok": not missing,
        "detail": "All four CARACAL_* variables present." if not missing
                  else f"Missing: {', '.join(missing)}",
    })

    coord = os.environ.get("CARACAL_COORDINATOR_URL", "")
    if coord:
        ok, detail = await _ping(coord.rstrip("/") + "/healthz")
        steps.append({"id": "caracal_coord", "label": "Caracal coordinator reachable",
                      "ok": ok, "detail": detail})
    else:
        steps.append({"id": "caracal_coord", "label": "Caracal coordinator reachable",
                      "ok": False, "detail": "CARACAL_COORDINATOR_URL not set."})

    gw = os.environ.get("CARACAL_GATEWAY_URL", "")
    if gw:
        ok, detail = await _ping(gw.rstrip("/") + "/healthz")
        steps.append({"id": "caracal_gateway", "label": "Caracal gateway reachable",
                      "ok": ok, "detail": detail})

    from app.api.hooks import required_secret_envs
    missing_secrets = [k for k in required_secret_envs() if not os.environ.get(k)]
    steps.append({
        "id": "webhook_secrets",
        "label": "Webhook signing secrets set",
        "ok": not missing_secrets,
        "detail": "All provider hook secrets present." if not missing_secrets
                  else f"Missing: {', '.join(missing_secrets)}",
    })

    overall = all(s["ok"] for s in steps)
    return JSONResponse({"ok": overall, "steps": steps})

