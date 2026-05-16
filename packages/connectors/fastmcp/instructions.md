# connectors/fastmcp

## Scope
- Covers the per-language FastMCP adapters for Caracal MCP authentication.

## Required
- Each language subdirectory must adapt the `transport-mcp` core onto the FastMCP middleware shape.

## Forbidden
- Must not host generic auth logic that belongs in `transport-mcp`.
