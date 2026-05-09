# caracalai-mcp

## Scope
- Covers only the `@caracalai/mcp` package under `caracal/packages/caracalai-mcp/`.

## Required
- Must wire the Express bearer-token middleware to `@caracalai/identity` for JWT verify, JWKS, scope, and claim shapes.
- Must consult the `RevocationStore` iface from `@caracalai/revocation` on every authenticated request; the store is a required option on the middleware.
- Must use PostgresBackend for per-user MCP token state; no SQLite.

## Forbidden
- Must not implement JWT verify, JWKS fetch, scope parsing, or claim types in this package.
- Must not import from `caracalEnterprise/`.
- Must not log plaintext bearer tokens.
- Must not merge with `caracalai-mcp-fastmcp`.
