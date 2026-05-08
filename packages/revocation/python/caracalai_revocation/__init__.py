# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# caracalai_revocation — RevocationStore protocol and in-memory default.

from .iface import RevocationStore
from .inmem import InMemoryRevocationStore

__all__ = ["InMemoryRevocationStore", "RevocationStore"]
