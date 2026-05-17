# packages/identity/python

## Scope
- Covers the `caracalai-identity` Python package under `packages/identity/python/`.

## Architecture Design
- The package verifies Caracal JWTs, fetches/caches JWKS, evaluates scopes, and exposes typed claims.
- It depends on `caracalai-core`, PyJWT, and httpx.

## Required
- Must require Python 3.14+ through `pyproject.toml`.
- Must keep the public surface exported from `caracalai_identity/__init__.py`.
- Must keep verification independent of FastAPI, MCP, Redis, and Postgres.

## Forbidden
- Must not host transport, framework, storage, or runtime adapter code.
- Must not silently accept invalid issuers, audiences, expiry, scopes, or signatures.
- Must not import from `caracalEnterprise/`.

## Validation
- Validate with the relevant `tests/python/unit/caracalai_identity` and security identity tests.

