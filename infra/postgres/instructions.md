# caracal/postgres

## Scope
- Covers only the PostgreSQL schema, migrations, and image build under `caracal/infra/postgres/`.

## Required
- Must use PostgreSQL 18 only.
- Must listen on port 5432 only.
- Must apply numbered `NNNN_*.up.sql` migrations in order; pair every `up` with a `down`.
- Must keep `audit_events` writable only by `caracalAudit` (INSERT + SELECT).
- Must keep `policy_versions` immutable through the `reject_policy_version_mutation` trigger.
- Must store secrets only as ChaCha20 ciphertext in `secrets.ciphertext` with `nonce` and `dek_id` populated.
- Must use CamelCase role names (e.g., `caracalSts`).

## Forbidden
- Must not import or reference `caracalEnterprise/`.
- Must not edit a committed migration file in place; add a new numbered migration instead.
- Must not grant UPDATE or DELETE on `audit_events` to any role.
- Must not grant write on `policy_versions` to any role.
- Must not store plaintext credentials, tokens, or subject claims in any column.
