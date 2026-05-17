# packages/transport/mcp

## Scope
- Covers Model Context Protocol authentication package grouping under `packages/transport/mcp/`.

## Architecture Design
- MCP transport packages authenticate Caracal-issued bearer tokens and return transport-neutral auth results.
- Framework adapters for Express, FastMCP, and Go net/http live under `packages/connectors/`.

## Required
- Must keep each language implementation in its own child directory.
- Must consume identity and revocation through public package interfaces.
- Must keep authentication results typed and framework-neutral.

## Forbidden
- Must not host framework middleware or storage backends.
- Must not perform provider-specific request routing.
- Must not log plaintext tokens.

## Validation
- Validate through the touched child package and MCP transport tests for that language.

