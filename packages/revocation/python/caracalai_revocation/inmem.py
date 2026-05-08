# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# In-memory RevocationStore default with optional TTL eviction.

from __future__ import annotations

import time


class InMemoryRevocationStore:
    def __init__(self) -> None:
        self._entries: dict[str, float | None] = {}

    def is_revoked(self, sid: str) -> bool:
        expiry = self._entries.get(sid)
        if sid not in self._entries:
            return False
        if expiry is not None and time.time() * 1000 >= expiry:
            del self._entries[sid]
            return False
        return True

    def mark_revoked(self, sid: str, ttl_ms: int | None = None) -> None:
        self._entries[sid] = None if ttl_ms is None else time.time() * 1000 + ttl_ms
