# connectors/redis/ts

## Scope
- Covers only the `@caracalai/revocation-redis` TypeScript package.

## Required
- Must implement the `@caracalai/revocation` `RevocationStore` interface.
- Must keep Redis client requirements structural so callers can use compatible Redis clients.
- Must keep stream-consumer logic independent of MCP, Express, FastMCP, and identity packages.

## Forbidden
- Must not verify JWTs or own request authentication.
