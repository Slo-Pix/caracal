# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# PostgreSQL 18 base image for Caracal. Schema migrations are applied by the
# dbMigrate one-shot at boot. Runtime tuning is supplied via `command:` in
# compose to remain environment-aware.

# syntax=docker/dockerfile:1.7
FROM postgres:18-alpine@sha256:54451ecb8ab38c24c3ec123f2fd501303a3a1856a5c66e98cecf2460d5e1e9d7

ENV POSTGRES_DB=caracal \
    POSTGRES_INITDB_ARGS="--data-checksums --auth-host=scram-sha-256"

COPY migrations/ /migrations/
COPY --chmod=0755 scripts/migrate.sh /usr/local/bin/caracal-migrate

EXPOSE 5432
