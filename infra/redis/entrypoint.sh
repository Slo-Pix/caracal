#!/bin/sh
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Writes the runtime Redis config from REDIS_PASSWORD_FILE and REDIS_MAXMEMORY into
# a private tmpfs path, launches redis-server, provisions the Caracal streams
# and consumer groups once the server accepts connections, and waits on the
# server PID so the container's lifetime tracks redis itself.

set -eu

baseConf="/etc/caracal/redis.conf"
runConf="/run/caracal/redis.conf"
readyMark="/run/caracal/provisioned"

mkdir -p /run/caracal
umask 0077
cp "${baseConf}" "${runConf}"

if [ -n "${REDIS_PASSWORD_FILE:-}" ]; then
    if [ ! -r "${REDIS_PASSWORD_FILE}" ]; then
        echo "redis password file is not readable" >&2
        exit 1
    fi
    REDIS_PASSWORD="$(cat "${REDIS_PASSWORD_FILE}")"
fi

if [ -z "${REDIS_PASSWORD:-}" ]; then
    echo "REDIS_PASSWORD_FILE or REDIS_PASSWORD is required" >&2
    exit 1
fi

printf 'requirepass %s\n' "${REDIS_PASSWORD}" >> "${runConf}"

if [ -n "${REDIS_MAXMEMORY:-}" ]; then
    printf 'maxmemory %s\n' "${REDIS_MAXMEMORY}" >> "${runConf}"
fi

rm -f "${readyMark}"
redis-server "${runConf}" "$@" &
serverPid=$!
export REDISCLI_AUTH="${REDIS_PASSWORD}"

shutdown() {
    kill "${serverPid}" 2>/dev/null || true
    wait "${serverPid}" 2>/dev/null || true
    exit 0
}
trap shutdown INT TERM

redisPing() {
    redis-cli -h 127.0.0.1 -p 6379 --no-auth-warning PING 2>/dev/null
}

tries=0
until [ "$(redisPing)" = "PONG" ]; do
    tries=$((tries + 1))
    if [ "${tries}" -gt 100 ]; then
        echo "redis did not become ready" >&2
        kill "${serverPid}" 2>/dev/null || true
        exit 1
    fi
    sleep 0.2
done

REDIS_HOST=127.0.0.1 REDIS_PORT=6379 /usr/local/bin/caracal-provision-streams
touch "${readyMark}"

wait "${serverPid}"
