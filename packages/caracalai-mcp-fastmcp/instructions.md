# caracalai-mcp-fastmcp

## Scope
- Covers only the `@caracalai/mcp-fastmcp` package under `caracal/packages/caracalai-mcp-fastmcp/`.

## Required
- Must provide a separate middleware surface for FastMCP-based MCP servers.
- Must reuse JWKS validation from `@caracalai/mcp`.
- Must remain independently publishable from `@caracalai/mcp`.

## Forbidden
- Must not import from `caracalEnterprise/`.
- Must not merge with `@caracalai/mcp`.
- Must not log plaintext bearer tokens.
