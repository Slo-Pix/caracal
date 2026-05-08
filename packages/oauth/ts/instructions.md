# oauth/ts

## Scope
- Covers only the `@caracalai/oauth` TS package under `packages/oauth/ts/`.

## Required
- Must implement RFC 8693 token exchange against STS `/oauth/2/token`.
- Must define a `TokenCache` interface and ship `InMemoryTokenCache` as the default.
- Must perform pre-flight expiry check: re-exchange if token expires within `timeoutMs + 30 s`.
- Must retry once on 401 before propagating failure.
- Must surface `interaction_required` errors as `InteractionRequiredError` with `challengeId`.

## Forbidden
- Must not import provider, runtime, or framework SDKs (no Cloudflare, no Express, no FastMCP).
- Must not depend on `@caracalai/identity`, `@caracalai/revocation`, or `@caracalai/transport-mcp`.
- Must not persist tokens to disk.
- Must not log token values.
- Must not proactively refresh tokens.
- Must not share cache entries across different subject tokens.
