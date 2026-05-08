# mcp-express/ts

## Scope
- Covers only the `@caracalai/mcp-express` TS package under `packages/framework-adaptor/mcp-express/ts/`.

## Required
- Must adapt the `@caracalai/transport-mcp` `authenticate` result onto an Express `RequestHandler`.
- Must map every `AuthError` code to the matching HTTP status and JSON body.

## Forbidden
- Must not re-implement JWT verification or revocation lookup.
- Must not depend on FastMCP, net/http, or any storage backend.
