# policyIterate

## Scope
- Covers the denied-request to policy-set-simulation loop that lets teams iterate
  policies from real audit data.

## Architecture Design
- `iterate.mjs` holds pure orchestration that takes an injected transport.
- `run.mjs` wires the Caracal Admin API explain and simulate endpoints.

## Required
- Must use only the public Admin API surface and the Node standard library.
- Must keep orchestration pure and tested offline with an injected transport.
- Must treat a non-denied request as a no-op with a non-zero exit.

## Forbidden
- Must not import Caracal repository internals or call live services from tests.
- Must not embed admin tokens, secrets, or real endpoints.

## Validation
- Run `node --test` from this directory.
