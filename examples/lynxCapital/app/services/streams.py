"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Long-lived stream consumer that bridges the Pulse Market Data SSE feed onto the in-process event bus.
"""
from __future__ import annotations

import json
import os
import threading

import httpx

from app.events.bus import bus
from app.events.types import Event

_stop = threading.Event()
_threads: list[threading.Thread] = []


def _publish_tick(data: dict) -> None:
    bus.publish(Event(run_id="streams", category="service", kind="market.tick", payload=data))


def _consume_pulse(url: str, api_key: str, symbol: str) -> None:
    headers = {"X-Api-Key": api_key}
    params = {"symbol": symbol, "ticks": 50}
    while not _stop.is_set():
        try:
            with httpx.stream("GET", f"{url}/stream", headers=headers, params=params, timeout=None) as resp:
                event = "message"
                for line in resp.iter_lines():
                    if _stop.is_set():
                        return
                    if not line:
                        event = "message"
                    elif line.startswith("event:"):
                        event = line[6:].strip()
                    elif line.startswith("data:") and event == "tick":
                        _publish_tick(json.loads(line[5:].strip()))
        except Exception:
            if _stop.is_set():
                return
            _stop.wait(2.0)


def start_streams() -> None:
    url = os.getenv("LYNX_PARTNER_PULSE_MARKET_URL")
    api_key = os.getenv("LYNX_PARTNER_PULSE_MARKET_API_KEY")
    if not url or not api_key:
        return
    symbol = os.getenv("LYNX_PULSE_SYMBOL", "USD/EUR")
    t = threading.Thread(target=_consume_pulse, args=(url, api_key, symbol),
                         name="pulse-market-sse", daemon=True)
    t.start()
    _threads.append(t)


def stop_streams() -> None:
    _stop.set()
    for t in _threads:
        t.join(timeout=2.0)
    _threads.clear()
    _stop.clear()
