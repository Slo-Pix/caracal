# echoUpstream

## Scope
- Covers the self-contained echo upstream used by the first Caracal tutorial.

## Architecture Design
- Single zero-dependency Node HTTP service that echoes the forwarded request.
- Joins the external `caracalData` network so the Gateway resolves it by name.

## Required
- Must stay dependency-free and rely only on the Node standard library.
- Must keep the request handler pure and tested offline.
- Must expose `/healthz` for container readiness.

## Forbidden
- Must not import Caracal package source or call live third-party services.
- Must not add framework or transport dependencies.

## Validation
- Run `node --test` from this directory.
