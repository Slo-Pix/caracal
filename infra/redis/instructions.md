# infra/redis

## Scope
- Covers Redis configuration, image entrypoint, and stream provisioning under `infra/redis/`.

## Architecture Design
- Redis is the OSS event-stream and revocation propagation substrate.
- Stream and consumer-group provisioning is idempotent and reruns from the container entrypoint.

## Required
- Must use Redis 8 and port 6379.
- Must require authentication from `REDIS_PASSWORD_FILE` in container runtime.
- Must keep append-only persistence and `noeviction` semantics for stream safety.
- Must keep stream names and consumer groups aligned with producers, consumers, and tests.
- Must keep provisioning scripts idempotent.

## Forbidden
- Must not enable Redis modules.
- Must not allow stream eviction policies that can drop retained events unexpectedly.
- Must not store plaintext tokens, credentials, claims, or PII in stream payloads.

## Validation
- Validate Redis changes with `infra/redis/scripts/verify.sh` or the Compose Redis healthcheck path.

