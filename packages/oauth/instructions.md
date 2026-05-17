# packages/oauth

## Scope
- Covers per-language OAuth token-exchange packages under `packages/oauth/`.

## Architecture Design
- OAuth packages implement RFC 8693 token exchange against Caracal STS.
- They own safe in-memory token caching, interaction-required errors, and exchange response types.

## Required
- Must keep each language implementation in its own child directory.
- Must keep token exchange reusable by SDKs, transports, CLI/TUI engine flows, and tests.
- Must keep token values in memory only.

## Forbidden
- Must not persist access tokens, refresh tokens, or subject tokens to disk.
- Must not depend on identity, revocation, transport, framework, or provider SDK packages.
- Must not log token values.

## Validation
- Validate through the touched child package and OAuth tests for that language.

