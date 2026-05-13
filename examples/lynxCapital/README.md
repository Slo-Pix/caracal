# Lynx Capital

Autonomous financial execution layer demo. A FastAPI + LangGraph swarm that
processes a global SaaS payout cycle (~4,200 invoices, 5 regions) end-to-end
with a live agent topology view and SSE log stream.

## Requirements

- Python 3.11+
- Docker
- An OpenAI API key

## Quick start

### 1 — Install dependencies

```bash
cd caracal/examples/lynxCapital
python -m venv .venv && source .venv/bin/activate

pip install caracalai-sdk
pip install \
  -e _mock/sdk/lynx_sdk_stripe_treasury \
  -e _mock/sdk/lynx_sdk_tax \
  -e .
```

> **uv users:** `uv sync` resolves all four editables automatically via
> `[tool.uv.sources]` in `pyproject.toml`.

### 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and set `OPENAI_API_KEY=sk-...`. Everything else has working
defaults for the local mock network.

### 3 — Start the mock provider network

The mock network simulates all 11 external financial services (banking, ERP,
OCR, FX, compliance, vendor portal, tax) across REST, SSE, gRPC, and MCP.
Always build it locally — it is not published to any registry.

```bash
docker compose -f _mock/docker-compose.yml up -d --build
```

Services started:

| Container | Transport | Port |
|---|---|---|
| `mock-rest-1` | REST (13 providers) | 8800 |
| `mock-fx-stream-1` | SSE (FX rates) | 8810 |
| `mock-treasury-grpc-1` | gRPC | 50051 |
| `mock-compliance-grpc-1` | gRPC | 50052 |
| `mock-vendor-mcp-1` | MCP | 7800 |

### 4 — Start Caracal

Caracal (Coordinator + Gateway) must be running before Lynx starts. Install
the Caracal CLI and bring up the stack the same way any end user would —
**do not build from the caracal source tree**:

```bash
# Install the CLI once (no sudo, lands in ~/.local/bin)
curl -fsSL https://caracal.garudexlabs.com/install.sh | sh

# Bring up the OSS stack (coordinator, gateway, postgres, redis, ...)
caracal up
```

The stack listens on:

- Coordinator → `http://localhost:8090`
- Gateway     → `http://localhost:8091`

The defaults in `.env.example` already point at these. If you run Caracal on
different hosts/ports, edit the `CARACAL_*` block in your `.env`.

### 5 — Run Lynx Capital

```bash
uvicorn app.main:app --reload --port 8000
```

Open **http://localhost:8000**.

## Routes

| Path | Description |
|---|---|
| `/` | Landing — scenario summary |
| `/setup` | Validates `OPENAI_API_KEY` and Caracal connectivity |
| `/demo` | Chat interface + live agent topology graph |
| `/logs` | Color-coded runtime activity stream |
| `/prompts` | Example prompts grouped by execution pattern |

## Example prompts

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
caracal down
```

## Layout

```
app/             FastAPI app (api, web, agents, orchestration, services, events, core)
config/          company.yaml (copy, regions, providers, swarm caps, theme)
_mock/           Deterministic mock provider network (local only — not published)
tests/           Topology, lifecycle, and mock determinism tests
INSTRUCTIONS.md  Build rules
```
