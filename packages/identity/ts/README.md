# Caracal Identity for TypeScript

TypeScript JWT verification, JWKS cache, scope checks, and claim contracts for Caracal resource servers.

This package requires authoritative token claims including `exp`, `iat`, `jti`, `sub`, `sid`, `client_id`, `zone_id`, and `use`. Verification failures are authentication failures; callers should not fall back to anonymous or partially trusted identity state.

