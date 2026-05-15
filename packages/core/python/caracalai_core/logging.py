# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Centralized structured logging with secret-key redaction for Caracal Python services and SDKs.

from __future__ import annotations

import json
import logging
import os
import sys
import time
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


def is_secret_key(key: str) -> bool:
    if not key:
        return False
    lk = key.lower()
    return any(s in lk for s in SECRET_KEYS)


def redact(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {k: (REDACT_VALUE if is_secret_key(str(k)) else redact(v)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        seq = [redact(v) for v in value]
        return seq if isinstance(value, list) else tuple(seq)
    return value


class _JsonFormatter(logging.Formatter):
    def __init__(self, service: str) -> None:
        super().__init__()
        self._service = service

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname.lower(),
            "service": self._service,
            "msg": record.getMessage(),
            "time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
        }
        bound = getattr(record, "_caracal_bound", None)
        if isinstance(bound, Mapping):
            for k, v in redact(dict(bound)).items():
                payload[k] = v
        extra = getattr(record, "_caracal_extra", None)
        if isinstance(extra, Mapping):
            for k, v in redact(dict(extra)).items():
                payload[k] = v
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, separators=(",", ":"))


class DevLogger:
    """Structured JSON dev/diagnostics logger.

    Two streams in Caracal: this one (developer/infra) and AuditClient (immutable end-user audit).
    """

    def __init__(self, service: str, level: str | int = "info", bound: Mapping[str, Any] | None = None) -> None:
        self._service = service
        self._bound: dict[str, Any] = dict(bound or {})
        self._logger = logging.getLogger(f"caracal.{service}")
        if not self._logger.handlers:
            handler = logging.StreamHandler(stream=sys.stderr)
            handler.setFormatter(_JsonFormatter(service))
            self._logger.addHandler(handler)
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
        child._logger = self._logger
        return child

    def _emit(self, level: int, msg: str, fields: Mapping[str, Any] | None) -> None:
        if not self._logger.isEnabledFor(level):
            return
        record = self._logger.makeRecord(
            self._logger.name, level, "", 0, msg, (), None
        )
        record._caracal_bound = self._bound  # type: ignore[attr-defined]
        record._caracal_extra = dict(fields) if fields else None  # type: ignore[attr-defined]
        self._logger.handle(record)

    def debug(self, msg: str, **fields: Any) -> None: self._emit(logging.DEBUG, msg, fields)
    def info(self, msg: str, **fields: Any) -> None: self._emit(logging.INFO, msg, fields)
    def warn(self, msg: str, **fields: Any) -> None: self._emit(logging.WARNING, msg, fields)
    def warning(self, msg: str, **fields: Any) -> None: self._emit(logging.WARNING, msg, fields)
    def error(self, msg: str, **fields: Any) -> None: self._emit(logging.ERROR, msg, fields)
    def fatal(self, msg: str, **fields: Any) -> None: self._emit(logging.CRITICAL, msg, fields)


def create_logger(service: str, level: str | int | None = None) -> DevLogger:
    if level is None:
        level = os.environ.get("CARACAL_LOG_LEVEL", "info")
    return DevLogger(service, level)
