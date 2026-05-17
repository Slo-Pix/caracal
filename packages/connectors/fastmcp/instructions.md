# packages/connectors/fastmcp

## Scope
- Covers FastMCP adapter package grouping under `packages/connectors/fastmcp/`.

## Architecture Design
- TypeScript and Python child packages adapt transport-neutral MCP authentication to FastMCP host shapes.

## Required
- Must keep generic authentication logic in `packages/transport/mcp`.
- Must keep FastMCP-specific request and middleware shaping inside child packages.

## Forbidden
- Must not host storage backends or transport-neutral authentication logic.
- Must not add non-FastMCP adapters here.

## Validation
- Validate through the touched child package.

