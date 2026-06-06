"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Session endpoints: two-state gate (landing accepted, setup validated).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

router = APIRouter()

COOKIE = "lynx_accepted"
SETUP_COOKIE = "lynx_setup"


@router.post("/accept")
def accept(response: Response) -> dict:
    response.set_cookie(COOKIE, "1", max_age=86400, httponly=False, samesite="lax")
    return {"accepted": True}


@router.post("/setup-complete")
def setup_complete(request: Request, response: Response) -> dict:
    if request.cookies.get(COOKIE) != "1":
        response.delete_cookie(SETUP_COOKIE)
        raise HTTPException(status_code=403, detail="Accept terms before completing setup.")
    response.set_cookie(SETUP_COOKIE, "1", max_age=86400, httponly=False, samesite="lax")
    return {"setup": True}


@router.post("/clear")
def clear(response: Response) -> dict:
    response.delete_cookie(COOKIE)
    response.delete_cookie(SETUP_COOKIE)
    return {"accepted": False}
