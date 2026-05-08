# revocation

## Scope
- Covers the per-language `revocation` packages.

## Required
- Each language subdirectory must own one revocation lookup interface and an in-memory default implementation.

## Forbidden
- Must not embed transport, framework, or storage backends.
