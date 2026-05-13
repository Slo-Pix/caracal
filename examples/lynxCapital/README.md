# Lynx Capital

Autonomous financial execution layer demo. A FastAPI + LangGraph swarm that
processes a global SaaS payout cycle (~4,200 invoices, 5 regions) end-to-end
with a live agent topology view and SSE log stream.

## Requirements

- Python 3.11+
- Docker (for the mock provider network)
- An OpenAI API key

## Setup

```bash
cd caracal/examples/lynxCapital
python -m venv .venv && source .venv/bin/activate

# Install the project plus its three local editable packages (mock provider
# SDKs and the Caracal Python SDK). With uv: `uv sync` reads pyproject.toml
# and resolves everything automatically.
pip install \
  -e ../../packages/sdk/python \
  -e _mock/sdk/lynx_sdk_stripe_treasury \
  -e _mock/sdk/lynx_sdk_tax \
  -e .

cp .env.example .env
# edit .env and set OPENAI_API_KEY=sk-...
```

Start the mock provider network (one container that fronts all 11 external
services: banking, ERP, OCR, compliance, vendor portal, tax, FX):

```bash
docker compose -f _mock/docker-compose.yml up -d --build
```

Bring up Caracal (Coordinator + Gateway) and point `CARACAL_*` in `.env` at it
before starting Lynx — Caracal is required, not optional:

```bash
docker compose -f ../../infra/docker/docker-compose.yml up -d
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000.

## Routes

- `/`      Landing — scenario summary.
- `/setup` Validates `OPENAI_API_KEY`.
- `/demo`  Chat + live agent graph.
- `/logs`  Color-coded runtime activity stream.
- `/prompts` Example prompts grouped by execution pattern.

## Tests

```bash
pytest tests/
```

## Layout

```
app/             FastAPI app (api, web, agents, orchestration, services, events, core)
config/          company.yaml (copy, regions, providers, swarm caps, theme)
_mock/           Deterministic mock provider network (the only network boundary)
tests/           Topology, lifecycle, and mock determinism tests
INSTRUCTIONS.md  Build rules
```
