# Lynx Capital

Autonomous financial execution reference lab. A FastAPI + LangGraph swarm that
processes a global SaaS payout cycle (~4,200 invoices, 5 regions) end-to-end
with a live agent topology view and SSE log stream.

The app calls a local network of provider mocks directly. The provider mocks
live under `_mock/` and cover every external integration the swarm needs.

## Requirements

- Python 3.14+
- Docker
- An OpenAI API key

## Quick start

### 1: Install dependencies

```bash
cd caracal/examples/lynxCapital
python -m venv .venv && source .venv/bin/activate

pip install -e .
pip install \
  -e _mock/sdk/lynx_sdk_stripe_treasury \
  -e _mock/sdk/lynx_sdk_tax
```

### 2: Configure environment

```bash
cp .env.example .env
```

Open `.env` and set `OPENAI_API_KEY=sk-...`. Provider URLs and credentials are
normal integration settings and ship with working local defaults.

### 3: Start the local provider network

The local provider network lives under `_mock/` and supplies deterministic
reference-lab provider fixtures across REST, SSE, gRPC, and MCP. The provider
lab additionally exposes one realistic external-style provider per Caracal
provider auth category, each on its own localhost port with a small control UI.

```bash
docker compose -f _mock/docker-compose.yml up -d --build --wait
```

To re-check status later:

```bash
docker compose -f _mock/docker-compose.yml ps -a
```

### 4: Run Lynx Capital

Pick one path:

```bash
# Local Python (development)
python -m uvicorn app.main:app --reload --port 8000

# Container (production-like: joins the provider network)
docker compose up -d --build
```

Open **http://localhost:8000**.

## Run flow

1. Open `http://localhost:8000/setup` and validate the environment and provider
   network.
2. Open `/demo` and submit a prompt. The browser uses the Lynx control API:
   `POST /api/run/start`, `GET /api/run/{runId}/events`,
   `GET /api/run/{runId}/status`, `POST /api/run/{runId}/cancel`, and
   `GET /api/run/{runId}/lineage`.

## Routes

| Path | Description |
|---|---|
| `/` | Landing: scenario summary |
| `/setup` | Validates `OPENAI_API_KEY` and provider connectivity |
| `/demo` | Chat interface + live agent topology graph |
| `/logs` | Color-coded runtime activity stream |
| `/prompts` | Example prompts grouped by execution pattern |

## Reference prompts

The `/prompts` page lists ready-to-run prompts. A few to start with:

- *"Run the full global payout cycle for this month."*
- *"Process all US region vendor invoices and submit to QuickBooks."*
- *"Run treasury close for Q2 and file compliance reports for DE and SG."*
- *"Audit all open receivables and flag overdue accounts."*

## Tests

```bash
pytest tests/
```

## Tear down

```bash
docker compose -f _mock/docker-compose.yml down
```

## Layout

```
app/             FastAPI app (api, web, agents, orchestration, services, events, core)
config/          company.yaml (copy, regions, providers, swarm caps, theme)
_mock/           Local provider fixtures and the provider lab (not published)
tests/           Topology, lifecycle, and provider transport tests
instructions.md  Build rules
```

## Provider mock lab

`_mock/providerlab/` serves two mock external providers for every Caracal
provider auth category, each on its own `localhost` port (`9400`–`9415`) with a
small control UI. Wire field names use third-party industry shapes
(`clientId`, `apiKey`, `accessToken`) so each provider behaves like a real
outside service.

| Category | Providers | Ports | Boundary behavior |
|---|---|---|---|
| `api_key` | Aurum Pay, Quill OCR | 9400, 9401 | key in header vs. query |
| `bearer_token` | Nimbus Ledger, Vela Mail | 9402, 9403 | standard vs. custom header/scheme |
| `oauth2_client_credentials` | Helios FX, Orbit ERP | 9404, 9405 | `client_secret_basic` vs. `client_secret_post` + audience |
| `oauth2_authorization_code` | Corvus Bank, Lumen CRM | 9406, 9407 | PKCE vs. offline refresh |
| `caracal_mandate` | Atlas Treasury, Sentinel Compliance | 9408, 9409 | verifier-SDK semantics; delegation-required |
| `none` (internal) | Core Billing, Core Identity | 9410, 9411 | behind the boundary, no upstream credential |
| `mcp` | Forge Tools, Relay | 9412, 9413 | bearer-guarded vs. mandate-guarded JSON-RPC |
| `sdk` | Zephyr Pay, Terra Tax | 9414, 9415 | HTTP provider behind a pip SDK shim |

Run the whole lab in one process, a single provider, or one container each:

```bash
python -m _mock.providerlab.run                                   # all 16, localhost
PROVIDERLAB_PROVIDER=helios-fx python -m _mock.providerlab.server  # one provider
docker compose -f _mock/providerlab/docker-compose.yml up --build  # one container each
```

Each provider exposes `/` (overview), `/__lab/credentials`, `/__lab/clients`,
`/__lab/api-clients`, its `/api/{operation}` domain surface, OAuth/MCP surfaces
where relevant, and `/healthz`. Credentials are seeded on first start and
persist under `_mock/providerlab/_store/` (git-ignored); a consolidated
`_store/_seed_index.json` lists every provider's seed for verification flows.
Set `PROVIDERLAB_FAST=1` to disable injected latency and transient faults.

## Caracal integration

This reference lab is currently provider-direct: it calls upstream providers
with their own credentials and no Caracal runtime in the path. The planned,
thin Caracal SDK integration is documented separately in
[`docs/INTEGRATION_PLAN.md`](./docs/INTEGRATION_PLAN.md). The provider lab under
`_mock/providerlab/` mirrors every Caracal provider auth category so that
integration can be validated end-to-end.
