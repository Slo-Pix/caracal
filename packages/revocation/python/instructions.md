# packages/revocation/python

## Scope
- Covers the `caracalai-revocation` Python package under `packages/revocation/python/`.

## Architecture Design
- The package defines a `RevocationStore` protocol and an in-memory implementation.

## Required
- Must require Python 3.14+ through `pyproject.toml`.
- Must keep dependencies limited to the Python standard library.
- Must keep the public surface exported from `caracalai_revocation/__init__.py`.

## Forbidden
- Must not depend on identity, transport, Redis, Postgres, or framework packages.
- Must not verify JWTs.

## Validation
- Validate with the relevant `tests/python/unit/caracalai_revocation` tests.

