# connectors/cloudflare/ts

## Scope
- Covers only the `@caracalai/runtime-cloudflare` TS package under `packages/connectors/cloudflare/ts/`.

## Required
- Must contain only Cloudflare Workers runtime adaptors: fetch wrapper and JWKS adaptor.
- Must use Web Crypto and the Workers `fetch` only.

## Forbidden
- Must not implement token caching or any state backend.
- Must not use Node-only modules (fs, path, `node:` builtins, etc.).
- Must not log token values.
