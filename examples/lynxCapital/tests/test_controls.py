"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Tests for the approval gate, keyword session-memory recall, and event-log persistence.
"""
from __future__ import annotations

import asyncio
import json


from app.core.approvals import ApprovalGate
from app.core.session_memory import RunRecord, SessionMemory
from app.events.bus import EventBus
from app.events import types as ev


def test_approval_disabled_auto_proceeds(monkeypatch):
    monkeypatch.delenv("LYNX_REQUIRE_APPROVAL", raising=False)
    gate = ApprovalGate()
    assert gate.required() is False


def test_approval_approve_flow(monkeypatch):
    monkeypatch.setenv("LYNX_REQUIRE_APPROVAL", "1")
    gate = ApprovalGate()
    assert gate.required() is True

    async def scenario():
        request_id, pending = await gate.request("run-1", "submit_payment")
        assert gate.list_pending("run-1") == [{"requestId": request_id, "action": "submit_payment"}]
        waiter = asyncio.create_task(gate.wait("run-1", request_id, pending))
        await asyncio.sleep(0)
        assert gate.resolve("run-1", request_id, True, "ok") is True
        decision = await waiter
        assert decision.approved is True
        assert gate.list_pending("run-1") == []

    asyncio.run(scenario())


def test_approval_timeout_denies(monkeypatch):
    monkeypatch.setenv("LYNX_REQUIRE_APPROVAL", "1")
    monkeypatch.setenv("LYNX_APPROVAL_TIMEOUT", "0.05")
    gate = ApprovalGate()

    async def scenario():
        request_id, pending = await gate.request("run-2", "transfer_funds")
        decision = await gate.wait("run-2", request_id, pending)
        assert decision.approved is False
        assert "timed out" in decision.reason

    asyncio.run(scenario())


def test_resolve_unknown_request_returns_false():
    gate = ApprovalGate()
    assert gate.resolve("nope", "missing", True) is False


def test_session_memory_keyword_recall():
    mem = SessionMemory()
    mem._runs.extend([
        RunRecord("aaaaaaaa", "reconcile vendor invoices in EMEA", "completed", ["EMEA"], []),
        RunRecord("bbbbbbbb", "hedge treasury fx exposure", "completed", ["APAC"], []),
        RunRecord("cccccccc", "screen new supplier for sanctions", "completed", ["AMER"], []),
    ])
    # add recent runs so older relevant one must be surfaced by keyword overlap
    for i in range(5):
        mem._runs.append(RunRecord(f"recent{i}", f"unrelated daily summary {i}", "completed", [], []))
    block = mem.context_block("please reconcile the vendor invoices again")
    assert "aaaaaaaa" in block  # relevant older run surfaced despite not being recent


def test_event_log_persistence(tmp_path, monkeypatch):
    monkeypatch.setenv("LYNX_EVENT_LOG_DIR", str(tmp_path))
    bus = EventBus()
    bus.publish(ev.run_start("run-x", "do the thing"))
    bus.publish(ev.run_end("run-x", "completed"))
    log_file = tmp_path / "run-x.jsonl"
    assert log_file.exists()
    lines = log_file.read_text().strip().splitlines()
    assert len(lines) == 2
    first = json.loads(lines[0])
    assert first["kind"] == "run_start"
    assert first["run_id"] == "run-x"


def test_event_log_disabled_by_default(tmp_path, monkeypatch):
    monkeypatch.delenv("LYNX_EVENT_LOG_DIR", raising=False)
    bus = EventBus()
    bus.publish(ev.run_start("run-y", "no persistence"))
    assert not list(tmp_path.iterdir())
