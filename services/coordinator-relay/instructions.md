# services/coordinator-relay

## Scope
- Covers the Go coordinator relay service under `services/coordinator-relay/`.

## Architecture Design
- The relay consumes `caracal.agents.lifecycle` with the `coordinator-relay` consumer group.
- Redis pending-entry draining, auto-claim reaping, HMAC verification, dedupe, and acknowledgement live in `internal/consumer.go`.
- The relay observes and logs lifecycle delivery; authoritative agent state remains in `apps/coordinator`.

## Required
- Must use Go 1.26 and `packages/core/go` for config, crypto, and logging.
- Must require `REDIS_URL` and require `STREAMS_HMAC_KEY` when `CARACAL_MODE=runtime`.
- Must dedupe on `outbox_id` within `RELAY_DEDUPE_WINDOW_SEC`.
- Must drain existing pending entries before normal consumption.
- Must XACK invalid-signature and duplicate events after handling them.

## Forbidden
- Must not mutate coordinator PostgreSQL state.
- Must not process lifecycle events without signature verification in runtime mode.
- Must not consume streams other than `caracal.agents.lifecycle`.
- Must not import from `apps/coordinator` or `caracalEnterprise/`.

## Validation
- Validate with `go test ./services/coordinator-relay/...` when relay code changes.

