"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

FastAPI application entry point.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import load_config

load_dotenv(Path(__file__).parent.parent / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_config()
    from app import caracal
    # Build the Caracal client at startup so token exchange and resource bindings
    # are ready before the first run; no-op when the integration is unconfigured.
    caracal.runtime()
    from app.services.streams import start_streams, stop_streams
    start_streams()
    try:
        yield
    finally:
        stop_streams()
        # Release the Caracal client's pooled transports and token refresh on shutdown.
        await caracal.aclose()


app = FastAPI(title="Lynx Capital", lifespan=lifespan)

from app import caracal
# Establish the inbound Caracal context per request so delegated authority
# propagates into each run; returns None (skipped) when the integration is off.
_caracal_mw = caracal.context_middleware()
if _caracal_mw is not None:
    app.add_middleware(_caracal_mw)

_static = Path(__file__).parent / "web" / "static"
if _static.exists():
    app.mount("/static", StaticFiles(directory=str(_static)), name="static")

from app.api import router as api_router
app.include_router(api_router, prefix="/api")

from app.api.hooks import router as hooks_router
app.include_router(hooks_router)

from app.web.router import router as web_router
app.include_router(web_router)
