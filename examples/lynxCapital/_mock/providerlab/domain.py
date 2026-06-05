"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Domain entry point that loads every provider module and re-exports the shared state, context, and dispatch contract.
"""
from __future__ import annotations

from _mock.providerlab import providers  # noqa: F401  (import populates registries)
from _mock.providerlab.providers.base import (  # noqa: F401
    Ctx,
    DomainError,
    State,
    dispatch,
    new_id,
    now,
)
