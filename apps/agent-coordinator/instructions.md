# agent-coordinator

## Scope
- Covers the agent coordinator app under caracal/apps/agent-coordinator/ only.

## Required
- Must use TypeScript on Node 24 (coordinator core, port 4000) and Go 1.26 (relay, no port).
- Must listen on port 4000 only (coordinator).
- Must enforce hard limits: depth ≤ 10, children ≤ 10, total agents ≤ 50 per zone.
- Must cascade-terminate all descendants on terminate request.
- Must enqueue every lifecycle, revocation, invocation, and delegation event to caracal_outbox; never xadd directly.
- Must serialize agent spawn caps and delegation graph mutations with pg_advisory_xact_lock per zone.
- Must guard background sweeps with pg_try_advisory_xact_lock for leader election.
- Must use github.com/garudex-labs/caracal/shared/* for Go relay config and logging.

## Forbidden
- Must not import from caracalEnterprise/.
- Must not allow soft-bypass of agent limits.
- Must not store plaintext claims or credentials.
- Must not bypass the outbox by calling redis.xadd from request handlers or sweepers.
