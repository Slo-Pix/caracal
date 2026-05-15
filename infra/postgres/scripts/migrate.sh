#!/bin/sh
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Idempotent migration applier for /migrations/*.up.sql; honors the same
# schema_migrations table the API uses, so re-runs and concurrent API boots are safe.

set -eu

migrations_dir="${MIGRATIONS_DIR:-/migrations}"
lock_key="${MIGRATION_ADVISORY_LOCK_KEY:-4732518903281471}"

psql -v ON_ERROR_STOP=1 -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
" >/dev/null

for path in $(ls "${migrations_dir}"/*.up.sql 2>/dev/null | sort); do
    version=$(basename "${path}" .up.sql)
    already=$(psql -tAXc "SELECT 1 FROM schema_migrations WHERE version='${version}' LIMIT 1")
    if [ "${already}" = "1" ]; then
        continue
    fi
    echo "applying ${version}"
    psql -v ON_ERROR_STOP=1 --single-transaction \
        -c "SELECT pg_advisory_xact_lock(${lock_key});" \
        -c "DO \$\$ BEGIN IF EXISTS (SELECT 1 FROM schema_migrations WHERE version='${version}') THEN RAISE NOTICE 'skip ${version}'; END IF; END \$\$;" \
        -f "${path}" \
        -c "INSERT INTO schema_migrations(version) VALUES ('${version}') ON CONFLICT DO NOTHING;"
done

echo "migrations up to date"
