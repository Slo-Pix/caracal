# Echo Upstream

A zero-dependency HTTP echo service that gives the first Caracal tutorial a
self-contained protected target. It removes the need to own a reachable upstream
before you have seen Caracal work end to end.

Every request is answered with JSON describing the method, path, headers, and
body the Gateway forwarded, so you can confirm that a brokered, policy-checked
request actually reached an upstream.

## Run it

The Caracal control plane runs independently (`caracal up`). This service joins
the same `caracalData` network so the Gateway can reach it by name.

```bash
cd examples/echoUpstream
docker compose -f compose.yml up --build
```

The Gateway reaches it at `http://echoUpstream:8088`. From your host it is
available at `http://127.0.0.1:8088` (try `curl http://127.0.0.1:8088/healthz`).

You can also run it directly without Docker:

```bash
node server.mjs           # listens on :8088 (override with ECHO_PORT)
```

## Use as the tutorial upstream

When you create the resource in the Console (or via the Control API), set the
upstream URL to `http://echoUpstream:8088`. A Gateway-mediated request then
returns the echoed JSON, proving the brokered path works without any external
dependency.

## Test

```bash
node --test
```
