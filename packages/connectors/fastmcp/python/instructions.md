# packages/connectors/fastmcp/python

## Scope
- Covers the `caracalai-mcp-fastmcp` Python package under `packages/connectors/fastmcp/python/`.

## Architecture Design
- The package adapts `caracalai_transport_mcp.authenticate` to FastMCP authentication hooks.
- FastMCP support is optional through package extras.

## Required
- Must require Python 3.14+ through `pyproject.toml`.
- Must call `caracalai_transport_mcp.authenticate` for token verification.
- Must require caller-provided revocation behavior and forward it to transport authentication.

## Forbidden
- Must not implement JWT verification, JWKS fetching, or revocation lookup directly.
- Must not depend on Express, Go net/http, Redis, or Postgres.
- Must not pass unauthenticated requests to FastMCP handlers.

## Validation
- Validate with the relevant `tests/python/unit/caracalai_mcp_fastmcp` tests.

