# caracalai-mcp

## Scope
- Covers only the `@caracalai/mcp` package under `caracal/packages/caracalai-mcp/`.

## Required
- Must validate bearer JWTs against zone JWKS on every MCP tool boundary.
- Must check `iss` (zone URL), `aud` (exact match), `exp`, and scope on every request.
- Must cache JWKS with 5-min TTL and stale-while-revalidate.
- Must use PostgresBackend for per-user token state; no SQLite.

## Forbidden
- Must not import from `caracalEnterprise/`.
- Must not ship SQLiteBackend.
- Must not log plaintext bearer tokens.
- Must not merge with `caracalai-mcp-fastmcp`.
