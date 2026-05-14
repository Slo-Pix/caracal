"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Long-lived stream consumers that bridge external streaming/event-driven
providers onto the in-process event bus.
"""
from __future__ import annotations

import os
import threading

from app.events.bus import bus
from app.events.types import Event
from app.services.transport.sse import SseConsumer


_consumers: list = []
_grpc_threads: list[threading.Thread] = []
_grpc_stop = threading.Event()


def _publish_fx(event: str, data: dict) -> None:
    bus.publish(Event(run_id="streams", category="service",
                      kind="fx.tick", payload={"event": event, **data}))


def _publish_compliance(delta: dict) -> None:
    bus.publish(Event(run_id="streams", category="service",
                      kind="compliance.delta", payload=delta))


def _run_compliance_stream() -> None:
    if os.getenv("LYNX_COMPLIANCE_GRPC") is None:
        return
    from app.services.transport.grpc_client import GrpcClient
    from app.services.transport.proto.compliance_stream import compliance_pb2, compliance_pb2_grpc

    client = GrpcClient(
        provider="compliance-nexus",
        target=os.environ["LYNX_COMPLIANCE_GRPC"],
        auth_header="authorization",
        auth_env="LYNX_COMPLIANCE_KEY",
    )
    cursor = ""
    while not _grpc_stop.is_set():
        try:
            request = compliance_pb2.StreamRequest(cursor=cursor)
            for delta in client.server_stream(
                compliance_pb2_grpc.ComplianceFeedStub, "StreamWatchlistDeltas", request,
            ):
                if _grpc_stop.is_set():
                    return
                cursor = delta.cursor
                _publish_compliance({
                    "cursor":    delta.cursor,
                    "list_name": delta.list_name,
                    "action":    delta.action,
                    "entity_id": delta.entity_id,
                    "country":   delta.country,
                    "reason":    delta.reason,
                    "ts":        delta.ts,
                })
        except Exception:
            if _grpc_stop.is_set():
                return
            _grpc_stop.wait(2.0)


def start_streams() -> None:
    fx_url = os.getenv("LYNX_FX_STREAM_URL")
    if fx_url:
        sse = SseConsumer(
            provider="fx-rates",
            url=fx_url,
            auth_header="X-API-Key",
            auth_env="LYNX_FX_KEY",
            on_event=_publish_fx,
        )
        sse.start()
        _consumers.append(sse)

    if os.getenv("LYNX_COMPLIANCE_GRPC"):
        t = threading.Thread(target=_run_compliance_stream, name="grpc-compliance", daemon=True)
        t.start()
        _grpc_threads.append(t)


def stop_streams() -> None:
    for c in _consumers:
        c.stop()
    _consumers.clear()
    _grpc_stop.set()
    for t in _grpc_threads:
        t.join(timeout=2.0)
    _grpc_threads.clear()
    _grpc_stop.clear()
