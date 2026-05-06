# caracalai-oauth

## Scope
- Covers only the `@caracalai/oauth` package under `caracal/packages/caracalai-oauth/`.

## Required
- Must implement RFC 8693 token exchange against STS `/oauth/2/token`.
- Must cache resource-scoped tokens in-process, keyed by `${subjectToken}::${resource}`.
- Must perform pre-flight expiry check: re-exchange if token expires within `timeoutMs + 30 s`.
- Must retry once on 401 before propagating failure.
- Must surface `interaction_required` errors as `InteractionRequiredError` with `challengeId`.

## Forbidden
- Must not import from `caracalEnterprise/`.
- Must not persist tokens to disk.
- Must not log token values.
- Must not proactively refresh tokens.
- Must not share cache entries across different subject tokens.
