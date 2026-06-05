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
```

### 2: Configure environment

```bash
cp .env.example .env
```

Open `.env` and set `OPENAI_API_KEY=sk-...`. Provider URLs and credentials are
normal integration settings and ship with working local defaults.

### 3: Start the local provider network

The local provider network lives under `_mock/` and supplies a realistic
ecosystem of twenty external-style providers across REST, SSE, gRPC, MCP, and
SDK-shim surfaces. Each provider runs on its own localhost port (`9400`–`9419`)
with a small control UI and behaves like a real third-party vendor.

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
_mock/           Local provider ecosystem (twenty external-style providers; not published)
tests/           Topology, lifecycle, providerlab, and partner integration tests
instructions.md  Build rules
```

## Provider ecosystem

`_mock/providerlab/` serves twenty realistic external-style providers, each on
its own `localhost` port (`9400`–`9419`) with a small control UI. Wire field
names use third-party industry shapes (`clientId`, `apiKey`, `accessToken`) so
each provider behaves like a real outside service rather than a Caracal fixture.
The providers are realistic first: every one exposes meaningful resources,
workflows, and failure behavior, and the auth categories Caracal must support
emerge naturally from that design.

| Provider | Domain | Auth | Protocol | Port |
|---|---|---|---|---|
| Halcyon Bank | Open/business banking | OAuth 2.0 auth code (PKCE) | REST + webhooks | 9400 |
| Meridian Pay | Card/wallet accept + payouts | API key (header) | REST + webhooks | 9401 |
| Cordoba FX | Cross-border FX | OAuth 2.0 client credentials (basic) | REST | 9402 |
| Ironbark ERP | Enterprise ERP | OAuth 2.0 client credentials (post + audience) | REST async-job | 9403 |
| Tallyhall Books | SMB accounting | OAuth 2.0 auth code (offline refresh) | REST | 9404 |
| Slate Ledger | Double-entry GL + close | Bearer token | REST async-job | 9405 |
| Inkwell OCR | Invoice/document extraction | API key (query) | REST async-job + LLM | 9406 |
| Aegis Screening | Sanctions/AML/KYB | Caracal mandate | REST + LLM | 9407 |
| Verafin Monitor | Txn monitoring + filing | Caracal mandate (delegation) | REST async-job | 9408 |
| Lumen Identity | Internal directory | none (internal) | REST | 9409 |
| Beacon CRM | Vendor/customer CRM | OAuth 2.0 auth code (refresh) | REST + webhooks | 9410 |
| Atlas Vendor Network | Vendor master data | MCP (bearer) | MCP JSON-RPC | 9411 |
| Keystone Treasury | Cash/forecast/hedge | API key (metadata) | gRPC-style | 9412 |
| Sabre Tax | Tax determination | SDK (api key) | SDK shim over REST | 9413 |
| Quetzal Payouts | Global mass payouts | SDK (api key) | SDK shim + webhooks | 9414 |
| Vela Notify | Email/SMS dunning | Bearer (custom header) | REST | 9415 |
| Core Billing | Internal AR/billing | none (internal) | REST | 9416 |
| Relay Automation | Workflow/job automation | MCP (mandate, delegation) | MCP JSON-RPC | 9417 |
| Pulse Market Data | Real-time FX/reference | API key (header) | SSE + REST | 9418 |
| Junction Procurement | Procure-to-pay | OAuth 2.0 client credentials | REST | 9419 |

Every Caracal auth category (`api_key`, `bearer_token`,
`oauth2_client_credentials`, `oauth2_authorization_code`, `caracal_mandate`,
`none`, `mcp`, `sdk`) and every protocol (REST, gRPC, MCP, SSE, SDK-shim,
webhooks) is represented. Providers that overlap in capability differ
significantly in implementation — Ironbark vs. Tallyhall accounting, Cordoba vs.
Pulse FX, Aegis vs. Verafin compliance, Sabre vs. Quetzal SDKs — so integration
code is exercised against the full range of real behavior, including idempotent
replay, async jobs, scope step-up, rate limits, transient outages, pagination,
and `402`/`403`/`404`/`409` paths.

Each provider runs a stateful domain module under
`_mock/providerlab/providers/<id>.py` with seeded, evolving datasets. It exposes
a Dashboard, Resource Explorer, Credentials, Clients, and API clients UI, its
`/api/{operation}` domain surface, OAuth/MCP/SSE surfaces where relevant, and
`/healthz`.

Run the whole ecosystem in one process, a single provider, or the container:

```bash
python -m _mock.providerlab.run                                       # all 20, localhost
PROVIDERLAB_PROVIDER=cordoba-fx python -m _mock.providerlab.server     # one provider
docker compose -f _mock/docker-compose.yml up -d --build              # container
```

Credentials are seeded on first start and persist under
`_mock/providerlab/_store/` (git-ignored); a consolidated `_store/_seed_index.json`
lists every provider's seed for verification flows. Set `PROVIDERLAB_FAST=1` to
disable injected latency and transient faults.

The application consumes these providers through `app/services/partners.py`,
which authenticates per category (api key, bearer, OAuth client-credentials,
OAuth authorization-code with PKCE/refresh, internal, and bearer-guarded MCP)
and exposes a single `call(provider_id, operation, payload)` surface. Agents
reach it through the partner-backed tools in `app/agents/tools.py`, so the swarm
drives real external providers end-to-end. Base URLs and credentials come from
`LYNX_PARTNER_*` env; print ready-to-source exports with
`python -m _mock.providerlab.seedenv`. The `caracal_mandate` providers (Aegis,
Verafin) and the mandate-guarded MCP server (Relay) are intentionally gated
(`PartnerPendingCaracal`) until the Caracal SDK integration phase.

## Caracal integration

This reference lab is currently provider-direct: it calls upstream providers
with their own credentials and no Caracal runtime in the path. The planned,
thin Caracal SDK integration is documented separately in
[`docs/INTEGRATION_PLAN.md`](./docs/INTEGRATION_PLAN.md). The provider ecosystem
under `_mock/providerlab/` mirrors every Caracal provider auth category so that
integration can be validated end-to-end.

