# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Centralized structured logging with secret-key redaction for Caracal Python services and SDKs.

from __future__ import annotations

import atexit
import json
import logging
import logging.handlers
import os
import queue
import re
import socket
import sys
import time
import traceback
from typing import Any, Mapping

SECRET_KEYS: tuple[str, ...] = (
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "id_token",
    "authorization",
    "auth",
    "cookie",
    "set-cookie",
    "client_secret",
    "private_key",
    "signing_key",
    "hmac_key",
    "encryption_key",
    "session",
    "credential",
    "credentials",
)

REDACT_VALUE = "***"

_LEVELS = {"debug": 10, "info": 20, "warn": 30, "warning": 30, "error": 40, "fatal": 50, "critical": 50}

_BEARER_RE = re.compile(r"bearer\s+[A-Za-z0-9._\-+/=]{8,}", re.IGNORECASE)
_JWT_RE = re.compile(r"eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}")


def is_secret_key(key: str) -> bool:
    if not key:
        return False
    lk = key.lower()
    return any(s in lk for s in SECRET_KEYS)


def redact_string(s: str) -> str:
    """Scrub Bearer tokens and JWT-shaped substrings; cheap when no match."""
    if len(s) < 16:
        return s
    s = _BEARER_RE.sub(f"Bearer {REDACT_VALUE}", s)
    s = _JWT_RE.sub(REDACT_VALUE, s)
    return s


def _serialize_exception(exc: BaseException) -> dict[str, Any]:
    out: dict[str, Any] = {
        "name": type(exc).__name__,
        "message": str(exc),
        "stack": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
    }
    if exc.__cause__ is not None:
        out["cause"] = _serialize_exception(exc.__cause__)
    return out


def redact(value: Any) -> Any:
    if isinstance(value, BaseException):
        return _serialize_exception(value)
    if isinstance(value, str):
        return redact_string(value)
    if isinstance(value, Mapping):
        return {k: (REDACT_VALUE if is_secret_key(str(k)) else redact(v)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        seq = [redact(v) for v in value]
        return seq if isinstance(value, list) else tuple(seq)
    return value


def _process_base_fields(service: str) -> dict[str, Any]:
    try:
        host = socket.gethostname() or "unknown"
    except OSError:
        host = "unknown"
    return {
        "service": service,
        "hostname": host,
        "pid": os.getpid(),
        "version": os.environ.get("CARACAL_VERSION", "dev"),
        "env": os.environ.get("CARACAL_ENV") or os.environ.get("APP_ENV") or "development",
    }


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created))
            + f".{int(record.msecs):03d}Z",
        }
        base = getattr(record, "_caracal_base", None)
        if isinstance(base, Mapping):
            payload.update(base)
        payload["msg"] = record.getMessage()
        bound = getattr(record, "_caracal_bound", None)
        if isinstance(bound, Mapping):
            for k, v in redact(dict(bound)).items():
                payload[k] = v
        extra = getattr(record, "_caracal_extra", None)
        if isinstance(extra, Mapping):
            for k, v in redact(dict(extra)).items():
                payload[k] = v
        if record.exc_info and record.exc_info[1] is not None:
            payload["error"] = _serialize_exception(record.exc_info[1])
        return json.dumps(payload, default=str, separators=(",", ":"))


# Process-wide queue infrastructure: log records produced by application threads
# are pushed onto a bounded queue by QueueHandler (cheap, no formatting), and a
# background QueueListener thread formats and writes to stderr.
_QUEUE_MAXSIZE = int(os.environ.get("CARACAL_LOG_QUEUE_SIZE", "16384"))
_log_queue: "queue.Queue[logging.LogRecord]" = queue.Queue(maxsize=_QUEUE_MAXSIZE)
_listener: logging.handlers.QueueListener | None = None
_listener_started = False
_dropped = 0


def _ensure_listener() -> None:
    global _listener, _listener_started
    if _listener_started:
        return
    handler = _DynamicStderrHandler()
    handler.setFormatter(_JsonFormatter())
    _listener = logging.handlers.QueueListener(_log_queue, handler, respect_handler_level=True)
    _listener.start()
    _listener_started = True
    atexit.register(_shutdown_listener)


class _DynamicStderrHandler(logging.Handler):
    """StreamHandler that resolves sys.stderr at emit time so test redirection works."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            msg = self.format(record)
            stream = sys.stderr
            stream.write(msg + "\n")
            try:
                stream.flush()
            except Exception:
                pass
        except Exception:  # noqa: BLE001
            self.handleError(record)


def _shutdown_listener() -> None:
    global _listener, _listener_started
    if _listener is not None:
        try:
            _listener.stop()
        except Exception:
            pass
        _listener = None
    _listener_started = False


def flush_for_test() -> None:
    """Block until the background queue is drained; intended for tests only."""
    _log_queue.join() if hasattr(_log_queue, "join") and False else None
    # QueueListener's internal queue does not support join(); poll instead.
    deadline = time.time() + 1.0
    while time.time() < deadline:
        if _log_queue.empty():
            return
        time.sleep(0.005)


class _NonBlockingQueueHandler(logging.Handler):
    """Pushes records onto the shared queue without blocking; drops when full."""

    def emit(self, record: logging.LogRecord) -> None:
        global _dropped
        try:
            _log_queue.put_nowait(record)
        except queue.Full:
            _dropped += 1


class DevLogger:
    """Structured JSON dev/diagnostics logger.

    Two streams in Caracal: this one (developer/infra) and AuditClient
    (immutable end-user audit). Records carry per-service base fields and are
    handed off to a background QueueListener so caller threads never block on
    stderr writes.
    """

    def __init__(self, service: str, level: str | int = "info", bound: Mapping[str, Any] | None = None) -> None:
        self._service = service
        self._bound: dict[str, Any] = dict(bound or {})
        self._base = _process_base_fields(service)
        _ensure_listener()
        self._logger = logging.getLogger(f"caracal.{service}")
        if not any(isinstance(h, _NonBlockingQueueHandler) for h in self._logger.handlers):
            self._logger.handlers.clear()
            self._logger.addHandler(_NonBlockingQueueHandler())
            self._logger.propagate = False
        self.set_level(level)

    def set_level(self, level: str | int) -> None:
        if isinstance(level, str):
            level = _LEVELS.get(level.lower(), logging.INFO)
        self._logger.setLevel(level)

    def with_(self, **fields: Any) -> "DevLogger":
        merged = dict(self._bound)
        merged.update(fields)
        child = DevLogger.__new__(DevLogger)
        child._service = self._service
        child._bound = merged
        child._base = self._base
        child._logger = self._logger
        return child

    def _emit(self, level: int, msg: str, fields: Mapping[str, Any] | None) -> None:
        if not self._logger.isEnabledFor(level):
            return
        exc_info = None
        if fields:
            err = fields.get("err") or fields.get("error") or fields.get("exception")
            if isinstance(err, BaseException):
                exc_info = (type(err), err, err.__traceback__)
        record = self._logger.makeRecord(self._logger.name, level, "", 0, msg, (), exc_info)
        record._caracal_base = self._base  # type: ignore[attr-defined]
        record._caracal_bound = self._bound  # type: ignore[attr-defined]
        record._caracal_extra = dict(fields) if fields else None  # type: ignore[attr-defined]
        self._logger.handle(record)

    def debug(self, msg: str, **fields: Any) -> None: self._emit(logging.DEBUG, msg, fields)
    def info(self, msg: str, **fields: Any) -> None: self._emit(logging.INFO, msg, fields)
    def warn(self, msg: str, **fields: Any) -> None: self._emit(logging.WARNING, msg, fields)
    def warning(self, msg: str, **fields: Any) -> None: self._emit(logging.WARNING, msg, fields)
    def error(self, msg: str, **fields: Any) -> None: self._emit(logging.ERROR, msg, fields)
    def fatal(self, msg: str, **fields: Any) -> None: self._emit(logging.CRITICAL, msg, fields)


def shutdown_logging() -> None:
    """Flush and stop the background log listener; safe to call multiple times."""
    _shutdown_listener()


def dropped_log_records() -> int:
    """Number of log records dropped because the background queue was full."""
    return _dropped


def create_logger(service: str, level: str | int | None = None) -> DevLogger:
    if level is None:
        level = os.environ.get("CARACAL_LOG_LEVEL") or os.environ.get("LOG_LEVEL") or "info"
    return DevLogger(service, level)

