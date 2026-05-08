# revocation/python

## Scope
- Covers only the `caracalai-revocation` Python package under `packages/revocation/python/`.

## Required
- Must expose a `RevocationStore` Protocol and an in-memory default implementation.
- Must depend only on the Python standard library.

## Forbidden
- Must not import any transport, framework, or storage backend.
