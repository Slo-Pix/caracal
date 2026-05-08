# revocation/ts

## Scope
- Covers only the `@caracalai/revocation` TS package under `packages/revocation/ts/`.

## Required
- Must define the revocation lookup interface and ship an in-memory default implementation.

## Forbidden
- Must not contain any storage backend code.
- Must not depend on identity, transport, or framework packages.
