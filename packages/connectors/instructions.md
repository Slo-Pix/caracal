# packages/connectors

## Scope
- Covers framework and storage adapters under `packages/connectors/`.

## Architecture Design
- Framework connectors adapt transport or SDK primitives to host runtimes.
- Storage connectors implement persistence-backed interfaces that neutral packages define elsewhere.
- Connector siblings must share through `core`, `identity`, `revocation`, `sdk`, or `transport`, not through each other.

## Required
- Must keep each connector under `<adapter>/<language>/`.
- Must keep request authentication fail-closed in production paths.
- Must document direct-host bypass risk where a connector only protects traffic that reaches it.
- Must keep framework adapters free of storage ownership unless the connector name is a storage backend.

## Forbidden
- Must not provide a public path that forwards unverified requests to host applications.
- Must not stub token verification with production runtime toggles.
- Must not import sibling connector internals.
- Must not import from `caracalEnterprise/`.

## Validation
- Validate through the touched connector package and its unit tests.

