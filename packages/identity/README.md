# Caracal Identity

`packages/identity` owns token identity verification only: JWT/JWKS validation, claim shape validation, scope checks, delegation-chain checks, and typed claim contracts.

## Production contract

Verified access tokens must carry authoritative session and issuance claims: `exp`, `iat`, `jti`, `sub`, `sid`, `client_id`, `zone_id`, and `use`. Resource servers should set the expected issuer, audience, zone, required scopes, and required token use for the execution path they are protecting.

The package does not perform transport authentication, framework middleware, token issuance, persistent storage, or revocation storage. Those concerns stay in transport, OAuth/STS, or revocation packages so identity verification remains reusable and deterministic.

## Language surfaces

| Language | Path | Package |
| --- | --- | --- |
| TypeScript | `packages/identity/ts` | `@caracalai/identity` |
| Go | `packages/identity/go` | `github.com/garudex-labs/caracal/packages/identity/go` |
| Python | `packages/identity/python` | `caracalai-identity` |

## Failure behavior

Malformed tokens, missing required claims, issuer/audience/zone mismatches, insufficient scopes, invalid delegation claims, and unsupported signing keys fail closed. Callers must treat verification failure as authentication failure and must not continue with anonymous or partially trusted identity state.

