<!--
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Phase-2 plan for wiring the Caracal SDK into the LynxCapital reference lab.
-->

# Caracal SDK integration plan

This is the **plan only**. No application code is wired to the SDK yet. The
LynxCapital app currently calls providers directly through
`app/services/registry.py`. This document describes the thin, correct,
end-to-end integration of the Caracal Python SDK (`caracalai-sdk==0.1.4rc1`)
once the provider mock lab under `_mock/providerlab/` is validated.

## 1. SDK surface used

From `caracalai_sdk` (the public `__all__`):

- `Caracal` — bound client. Built via `Caracal.from_env()`,
  `Caracal.from_client_secret(...)`, `Caracal.from_config(path)`, or
  `Caracal.connect(...)`.
- `CaracalConfig`, `ResourceBinding`, `GatewayRequest` — explicit construction
  and per-resource upstream routing.
- `CoordinatorClient` — coordinator REST client (`base_url`, async `close()`).
- `AgentKind`, `DelegationConstraints` — spawn/delegate shaping.
- `CaracalContext`, `capture_context`, `describe_authority`, `AuthoritySummary`
  — in-process identity/delegation context (contextvars).
- `CaracalContextASGIMiddleware`, `Verifier` — inbound boundary on the app's own
  ASGI surface.
- `Envelope`, `LifecycleHook` — propagation and lifecycle callbacks.

Client capabilities relied on (from `Caracal`): `transport()` /
`sync_transport()` (authenticated `httpx` clients), `gateway_request()` /
`fetch()`, `spawn()` / `delegate()` / `delegate_to_spawn()` / `bind()`
(async context managers), `headers()`, `bind_from_headers()`,
`context_middleware()`, `on_agent_start()` / `on_agent_end()`, and `close()`.

Service defaults: STS `http://localhost:8080`, Coordinator
`http://localhost:4000`, Gateway `http://localhost:8081`.

## 2. Identity model

- One **application** identity (zone + application_id) holds an application
  `client_secret`. The SDK's `ClientSecretExchanger` performs RFC 8693 token
  exchange against the STS to obtain and refresh the subject token; pass its
  `get_token` as `CaracalConfig.token_source` (never a static token in the lab).
- Each agent the swarm spawns runs inside a `spawn()` / `delegate()` context, so
  every upstream call carries a scoped, delegated mandate rather than the root
  application authority.
- Upstream providers receive a Caracal **envelope** (mandate + delegation
  anchors) at the gateway boundary; the provider's verifier validates it.

## 3. Provider category mapping

Each lab category maps to one integration shape. The lab is the rehearsal
surface for all of them.

| Lab category | Lab providers | SDK integration shape |
|---|---|---|
| `caracal_mandate` | Atlas Treasury, Sentinel Compliance | Primary path: route through the gateway via `gateway_request()` / `fetch()`; the provider verifies the Caracal envelope. Sentinel requires a delegated mandate (`delegate()` before the call). |
| `oauth2_client_credentials` | Helios FX, Orbit ERP | Non-Caracal upstream: the gateway holds the OAuth client credential; the app calls the gateway with a Caracal-scoped resource binding. App never sees the provider secret. |
| `oauth2_authorization_code` | Corvus Bank, Lumen CRM | User-consented upstream: tokens (incl. refresh) are held behind the gateway as a provider connection; the app references the resource binding only. |
| `api_key` | Aurum Pay, Quill OCR | Gateway-managed API key. App calls `gateway_request(resource_id)`; the gateway injects the upstream key. |
| `bearer_token` | Nimbus Ledger, Vela Mail | Same as `api_key`, static bearer held at the gateway. |
| `sdk` | Zephyr Pay, Terra Tax | First-party SDK clients are constructed with the gateway base URL and the SDK `transport()` httpx client so calls are enveloped. |
| `mcp` | Forge Tools, Relay | MCP tool calls flow through the SDK transport; Relay (mandate-guarded) requires a delegated context, Forge (bearer) uses a gateway-held token. |
| `none` (internal) | Core Billing, Core Identity | Behind the boundary; no upstream credential. Reached directly, still inside the active `CaracalContext` for audit propagation. |

The single rule: the application holds exactly one secret (its own
`client_secret`); every provider credential lives at the gateway and is selected
by `ResourceBinding(resource_id, upstream_prefix)`.

## 4. Wiring points (files)

Reintroduce the SDK at the same seams Phase 1 removed, no more:

- `app/caracal.py` (recreate) — own the single `Caracal` instance: build from
  env via `Caracal.from_env()`, expose `headers()`, `transport()` /
  `sync_transport()`, `gateway_request()`, the `spawn` / `delegate` context
  managers, and `close()`.
- `app/main.py` — construct the client in the FastAPI lifespan, install
  `context_middleware()` on the app, and `await client.close()` on shutdown.
- `app/services/registry.py` — resolve provider `base_url` to the gateway and
  obtain HTTP clients from `caracal.transport()` instead of building raw
  `httpx` clients with `AuthSpec` keys.
- `app/services/transport/{rest,grpc_client,mcp,sse}.py` — attach Caracal
  headers / enveloped transport at the call boundary.
- `app/orchestration/swarm.py` — wrap each spawned regional/workflow agent in
  `async with caracal.spawn(...)` / `caracal.delegate(...)` so delegation depth,
  hops, and TTL are bounded by `DelegationConstraints`.
- `app/api/setup.py` — re-add readiness checks for STS, Coordinator, and Gateway
  reachability and required resource bindings.
- `app/api/run.py` — gate run start on client readiness.
- Config: `pyproject.toml` (add `caracalai-sdk==0.1.4rc1`), regenerate
  `uv.lock` + `requirements.lock`, add `CARACAL_*` settings to `.env.example`,
  and re-add the coordinator/STS/gateway services to compose.

## 5. Configuration

New environment (mirrors `Caracal.from_env`): `CARACAL_ZONE_ID`,
`CARACAL_APPLICATION_ID`, `CARACAL_STS_URL`, `CARACAL_COORDINATOR_URL`,
`CARACAL_GATEWAY_URL`, the application `client_secret` (file or
`CARACAL_CLIENT_SECRET`), and resource bindings mapping each provider
`resource_id` to its `upstream_prefix`. Existing `LYNX_*_KEY` provider secrets
move out of the app and into gateway-held provider connections.

## 6. Rollout sequence

1. Validate the provider lab (this repo state): `PROVIDERLAB_FAST=1 pytest
   tests/test_providerlab.py` green; all 8 categories accept and reject
   correctly.
2. Stand up STS, Coordinator, and Gateway locally; register the LynxCapital
   application and the 16 resource bindings; move provider credentials to the
   gateway.
3. Recreate `app/caracal.py` and wire `app/main.py` lifespan + middleware only.
   Confirm the app boots and `/setup` reports the control plane reachable.
4. Switch `app/services/registry.py` to the gateway base URL + `transport()`
   for one category at a time, starting with `api_key` (Aurum Pay), then
   `bearer_token`, `oauth2_*`, `sdk`, `mcp`, and finally `caracal_mandate`.
5. Wrap the swarm in `spawn` / `delegate`; assert every agent emits start/end
   lifecycle events and a bounded delegation chain via `describe_authority`.
6. Add the inbound `Verifier` boundary if the app exposes callbacks that must
   themselves be authority-checked.

## 7. Acceptance criteria

- The app holds no provider secret; only its own application `client_secret`.
- Every upstream call carries a Caracal envelope and a delegated (not root)
  context; `allow_root` is never used on hot paths.
- `caracal_mandate` providers verify zone, audience, scopes, and delegation, and
  reject revoked anchors — exactly as the lab's `mandate.verify` already does.
- Token exchange refreshes before expiry with no per-call STS round trip.
- `pytest tests/` stays green; a new boundary test asserts enveloped headers
  reach each provider category.
- No mock logic moves out of `_mock/`; the lab remains the rehearsal surface.
