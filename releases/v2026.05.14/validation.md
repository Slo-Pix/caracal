---
title: v2026.05.14 Release Validation Report
---

# Caracal v2026.05.14 Release Validation

**Published:** 2026-05-14
**Ecosystem quality score:** 98% (pass / total checks)
**Total blockers:** 0

## Compatibility matrix

### CLI / TUI binaries

| Artifact | Version |
| --- | --- |
| `cli` | 2026.05.14 |
| `tui` | 2026.05.14 |

### Container images (ghcr.io/garudex-labs)

| Artifact | Version |
| --- | --- |
| `ghcr.io/garudex-labs/caracal-api` | v2026.05.14 |
| `ghcr.io/garudex-labs/caracal-coordinator` | v2026.05.14 |
| `ghcr.io/garudex-labs/caracal-audit` | v2026.05.14 |
| `ghcr.io/garudex-labs/caracal-gateway` | v2026.05.14 |
| `ghcr.io/garudex-labs/caracal-sts` | v2026.05.14 |
| `ghcr.io/garudex-labs/caracal-redis` | v2026.05.14 |

### PyPI packages

| Artifact | Version |
| --- | --- |
| `caracalai-core` | 0.1.1 |
| `caracalai-identity` | 0.1.1 |
| `caracalai-revocation` | 0.1.1 |
| `caracalai-sdk` | 0.1.1 |
| `caracalai-transport-mcp` | 0.1.1 |
| `caracalai-mcp-fastmcp` | 0.1.1 |
| `caracalai-revocation-redis` | 0.1.1 |

### npm packages

| Artifact | Version |
| --- | --- |
| `@caracalai/core` | 0.1.2 |
| `@caracalai/sdk` | 0.1.2 |
| `@caracalai/identity` | 0.1.2 |
| `@caracalai/revocation` | 0.1.2 |
| `@caracalai/oauth` | 0.1.2 |
| `@caracalai/admin` | 0.1.2 |
| `@caracalai/transport-a2a` | 0.1.2 |
| `@caracalai/transport-mcp` | 0.1.2 |
| `@caracalai/mcp-express` | 0.1.2 |
| `@caracalai/mcp-fastmcp` | 0.1.2 |
| `@caracalai/tokenstate-postgres` | 0.1.2 |
| `@caracalai/revocation-redis` | 0.1.2 |


## Summary

| Area | Pass | Warn | Fail | Blockers |
| --- | --- | --- | --- | --- |
| Registry Metadata | 19 | 7 | 0 | 0 |
| PyPI Install Matrix | 252 | 0 | 0 | 0 |
| npm Install Matrix | 108 | 0 | 0 | 0 |
| CLI Binaries | 25 | 0 | 0 | 0 |
| TUI Binaries | 25 | 0 | 0 | 0 |
| Installers | 3 | 1 | 0 | 0 |
| Container Stack | 7 | 0 | 0 | 0 |
| Provenance & Signing | 16 | 0 | 0 | 0 |
| Docs & Examples | 0 | 0 | 1 | 0 |

## Severity rubric

- **blocker** — artifact is unusable for consumers (download fails, install errors, signature invalid)
- **major** — published but a contract is broken (wrong version, missing export, broken healthcheck)
- **minor** — cosmetic or documentation issue
- **info** — informational only

## Findings

### Registry Metadata

- **[major]** WARN — `caracalai-core` (registry/pypi/-): license not Apache-2.0: ''
  - Repro: `curl https://pypi.org/pypi/caracalai-core/json | jq .info.license`
- **[info]** PASS — `caracalai-core` (registry/pypi/-): metadata ok @ 0.1.1
  - Repro: `curl https://pypi.org/pypi/caracalai-core/json`
- **[major]** WARN — `caracalai-identity` (registry/pypi/-): license not Apache-2.0: ''
  - Repro: `curl https://pypi.org/pypi/caracalai-identity/json | jq .info.license`
- **[info]** PASS — `caracalai-identity` (registry/pypi/-): metadata ok @ 0.1.1
  - Repro: `curl https://pypi.org/pypi/caracalai-identity/json`
- **[major]** WARN — `caracalai-revocation` (registry/pypi/-): license not Apache-2.0: ''
  - Repro: `curl https://pypi.org/pypi/caracalai-revocation/json | jq .info.license`
- **[info]** PASS — `caracalai-revocation` (registry/pypi/-): metadata ok @ 0.1.1
  - Repro: `curl https://pypi.org/pypi/caracalai-revocation/json`
- **[major]** WARN — `caracalai-sdk` (registry/pypi/-): license not Apache-2.0: ''
  - Repro: `curl https://pypi.org/pypi/caracalai-sdk/json | jq .info.license`
- **[info]** PASS — `caracalai-sdk` (registry/pypi/-): metadata ok @ 0.1.1
  - Repro: `curl https://pypi.org/pypi/caracalai-sdk/json`
- **[major]** WARN — `caracalai-transport-mcp` (registry/pypi/-): license not Apache-2.0: ''
  - Repro: `curl https://pypi.org/pypi/caracalai-transport-mcp/json | jq .info.license`
- **[info]** PASS — `caracalai-transport-mcp` (registry/pypi/-): metadata ok @ 0.1.1
  - Repro: `curl https://pypi.org/pypi/caracalai-transport-mcp/json`
- **[major]** WARN — `caracalai-mcp-fastmcp` (registry/pypi/-): license not Apache-2.0: ''
  - Repro: `curl https://pypi.org/pypi/caracalai-mcp-fastmcp/json | jq .info.license`
- **[info]** PASS — `caracalai-mcp-fastmcp` (registry/pypi/-): metadata ok @ 0.1.1
  - Repro: `curl https://pypi.org/pypi/caracalai-mcp-fastmcp/json`
- **[major]** WARN — `caracalai-revocation-redis` (registry/pypi/-): license not Apache-2.0: ''
  - Repro: `curl https://pypi.org/pypi/caracalai-revocation-redis/json | jq .info.license`
- **[info]** PASS — `caracalai-revocation-redis` (registry/pypi/-): metadata ok @ 0.1.1
  - Repro: `curl https://pypi.org/pypi/caracalai-revocation-redis/json`
- **[info]** PASS — `@caracalai/core` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/core`
- **[info]** PASS — `@caracalai/sdk` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/sdk`
- **[info]** PASS — `@caracalai/identity` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/identity`
- **[info]** PASS — `@caracalai/revocation` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/revocation`
- **[info]** PASS — `@caracalai/oauth` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/oauth`
- **[info]** PASS — `@caracalai/admin` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/admin`
- **[info]** PASS — `@caracalai/transport-a2a` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/transport-a2a`
- **[info]** PASS — `@caracalai/transport-mcp` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/transport-mcp`
- **[info]** PASS — `@caracalai/mcp-express` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/mcp-express`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/mcp-fastmcp`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/tokenstate-postgres`
- **[info]** PASS — `@caracalai/revocation-redis` (registry/npm/-): metadata ok @ 0.1.2
  - Repro: `curl https://registry.npmjs.org/@caracalai/revocation-redis`

### PyPI Install Matrix

- **[info]** PASS — `caracalai-core` (linux-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/pip/py3.13): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/uv/py3.12): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/pip/py3.12): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/pip/py3.14): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/uv/py3.11): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/poetry/py3.13): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/uv/py3.14): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/uv/py3.13): install + import ok @ 0.1.1
  - Repro: `uv install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/poetry/py3.12): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (linux-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (linux-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (linux-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (linux-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (linux-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (linux-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (linux-amd64/poetry/py3.11): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (darwin-arm64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (darwin-arm64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (darwin-arm64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (darwin-arm64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (darwin-arm64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (darwin-arm64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (darwin-arm64/pip/py3.11): install + import ok @ 0.1.1
  - Repro: `pip install caracalai-revocation-redis==0.1.1`
- **[info]** PASS — `caracalai-core` (windows-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-core==0.1.1`
- **[info]** PASS — `caracalai-identity` (windows-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-identity==0.1.1`
- **[info]** PASS — `caracalai-revocation` (windows-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation==0.1.1`
- **[info]** PASS — `caracalai-sdk` (windows-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-sdk==0.1.1`
- **[info]** PASS — `caracalai-transport-mcp` (windows-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-transport-mcp==0.1.1`
- **[info]** PASS — `caracalai-mcp-fastmcp` (windows-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-mcp-fastmcp==0.1.1`
- **[info]** PASS — `caracalai-revocation-redis` (windows-amd64/poetry/py3.14): install + import ok @ 0.1.1
  - Repro: `poetry install caracalai-revocation-redis==0.1.1`

### npm Install Matrix

- **[info]** PASS — `@caracalai/core` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (windows-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/revocation-redis@0.1.2`
- **[info]** PASS — `@caracalai/core` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (linux-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/revocation-redis@0.1.2`
- **[info]** PASS — `@caracalai/core` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (linux-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/revocation-redis@0.1.2`
- **[info]** PASS — `@caracalai/core` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (darwin-arm64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/revocation-redis@0.1.2`
- **[info]** PASS — `@caracalai/core` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (darwin-arm64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/revocation-redis@0.1.2`
- **[info]** PASS — `@caracalai/core` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (darwin-arm64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/revocation-redis@0.1.2`
- **[info]** PASS — `@caracalai/core` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (windows-amd64/pnpm/node24): install + ESM import ok @ 0.1.2
  - Repro: `pnpm add @caracalai/revocation-redis@0.1.2`
- **[info]** PASS — `@caracalai/core` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (windows-amd64/yarn/node24): install + ESM import ok @ 0.1.2
  - Repro: `yarn add @caracalai/revocation-redis@0.1.2`
- **[info]** PASS — `@caracalai/core` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/core@0.1.2`
- **[info]** PASS — `@caracalai/sdk` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/sdk@0.1.2`
- **[info]** PASS — `@caracalai/identity` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/identity@0.1.2`
- **[info]** PASS — `@caracalai/revocation` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/revocation@0.1.2`
- **[info]** PASS — `@caracalai/oauth` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/oauth@0.1.2`
- **[info]** PASS — `@caracalai/admin` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/admin@0.1.2`
- **[info]** PASS — `@caracalai/transport-a2a` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/transport-a2a@0.1.2`
- **[info]** PASS — `@caracalai/transport-mcp` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/transport-mcp@0.1.2`
- **[info]** PASS — `@caracalai/mcp-express` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/mcp-express@0.1.2`
- **[info]** PASS — `@caracalai/mcp-fastmcp` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/mcp-fastmcp@0.1.2`
- **[info]** PASS — `@caracalai/tokenstate-postgres` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/tokenstate-postgres@0.1.2`
- **[info]** PASS — `@caracalai/revocation-redis` (linux-amd64/npm/node24): install + ESM import ok @ 0.1.2
  - Repro: `npm add @caracalai/revocation-redis@0.1.2`

### CLI Binaries

- **[info]** PASS — `caracal-cli-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): --version returns 2026.05.14
  - Repro: `./caracal --version`
- **[info]** PASS — `caracal-cli-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): --version returns 2026.05.14
  - Repro: `./caracal.exe --version`
- **[info]** PASS — `caracal-cli-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): --version returns 2026.05.14
  - Repro: `./caracal --version`
- **[info]** PASS — `caracal-cli-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): --version returns 2026.05.14
  - Repro: `./caracal --version`
- **[info]** PASS — `caracal-cli-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): --version returns 2026.05.14
  - Repro: `./caracal --version`
- **[info]** PASS — `caracal-cli-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-cli-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`

### TUI Binaries

- **[info]** PASS — `caracal-tui-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): --version returns 2026.05.14
  - Repro: `./caracal-tui --version`
- **[info]** PASS — `caracal-tui-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): --version returns 2026.05.14
  - Repro: `./caracal-tui.exe --version`
- **[info]** PASS — `caracal-tui-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): --version returns 2026.05.14
  - Repro: `./caracal-tui --version`
- **[info]** PASS — `caracal-tui-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): --version returns 2026.05.14
  - Repro: `./caracal-tui --version`
- **[info]** PASS — `caracal-tui-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-linux-amd64-v2026.05.14.tar.gz` (linux-amd64/github/-): --version returns 2026.05.14
  - Repro: `./caracal-tui --version`
- **[info]** PASS — `caracal-tui-linux-arm64-v2026.05.14.tar.gz` (linux-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-darwin-amd64-v2026.05.14.tar.gz` (darwin-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-darwin-arm64-v2026.05.14.tar.gz` (darwin-arm64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`
- **[info]** PASS — `caracal-tui-windows-amd64-v2026.05.14.zip` (windows-amd64/github/-): checksum ok; not host-executable
  - Repro: `sha256 check`

### Installers

- **[info]** PASS — `install.sh` (windows-amd64/shell/-): installer placed caracal on PATH
  - Repro: `bash install.sh --version v2026.05.14`
- **[info]** PASS — `install.ps1` (windows-amd64/pwsh/-): PowerShell installer completed
  - Repro: `pwsh -File install.ps1 -Version v2026.05.14`
- **[info]** PASS — `install.sh` (linux-amd64/shell/-): installer placed caracal on PATH
  - Repro: `bash install.sh --version v2026.05.14`
- **[info]** WARN — `install.ps1` (linux-amd64/pwsh/-): PowerShell installer is only exercised on Windows runners
  - Repro: `pwsh -File install.ps1 -Version v2026.05.14`

### Container Stack

- **[info]** PASS — `ghcr.io/garudex-labs/caracal-api:v2026.05.14` (linux-amd64/ghcr/docker): image pulled
  - Repro: `docker pull ghcr.io/garudex-labs/caracal-api:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-coordinator:v2026.05.14` (linux-amd64/ghcr/docker): image pulled
  - Repro: `docker pull ghcr.io/garudex-labs/caracal-coordinator:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-audit:v2026.05.14` (linux-amd64/ghcr/docker): image pulled
  - Repro: `docker pull ghcr.io/garudex-labs/caracal-audit:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-gateway:v2026.05.14` (linux-amd64/ghcr/docker): image pulled
  - Repro: `docker pull ghcr.io/garudex-labs/caracal-gateway:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-sts:v2026.05.14` (linux-amd64/ghcr/docker): image pulled
  - Repro: `docker pull ghcr.io/garudex-labs/caracal-sts:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-redis:v2026.05.14` (linux-amd64/ghcr/docker): image pulled
  - Repro: `docker pull ghcr.io/garudex-labs/caracal-redis:v2026.05.14`
- **[info]** PASS — `stack` (linux-amd64/compose/docker): compose up succeeded
  - Repro: `docker compose up -d`

### Provenance & Signing

- **[info]** PASS — `caracal-cli-linux-amd64-v2026.05.14.tar.gz` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-cli-linux-amd64-v2026.05.14.tar.gz --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-tui-linux-amd64-v2026.05.14.tar.gz` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-tui-linux-amd64-v2026.05.14.tar.gz --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-cli-linux-arm64-v2026.05.14.tar.gz` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-cli-linux-arm64-v2026.05.14.tar.gz --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-tui-linux-arm64-v2026.05.14.tar.gz` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-tui-linux-arm64-v2026.05.14.tar.gz --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-cli-darwin-amd64-v2026.05.14.tar.gz` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-cli-darwin-amd64-v2026.05.14.tar.gz --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-tui-darwin-amd64-v2026.05.14.tar.gz` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-tui-darwin-amd64-v2026.05.14.tar.gz --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-cli-darwin-arm64-v2026.05.14.tar.gz` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-cli-darwin-arm64-v2026.05.14.tar.gz --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-tui-darwin-arm64-v2026.05.14.tar.gz` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-tui-darwin-arm64-v2026.05.14.tar.gz --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-cli-windows-amd64-v2026.05.14.zip` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-cli-windows-amd64-v2026.05.14.zip --repo Garudex-Labs/caracal`
- **[info]** PASS — `caracal-tui-windows-amd64-v2026.05.14.zip` (github/gh/-): attestation verified
  - Repro: `gh attestation verify caracal-tui-windows-amd64-v2026.05.14.zip --repo Garudex-Labs/caracal`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-api:v2026.05.14` (ghcr/docker/-): image SLSA provenance found
  - Repro: `docker buildx imagetools inspect ghcr.io/garudex-labs/caracal-api:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-coordinator:v2026.05.14` (ghcr/docker/-): image SLSA provenance found
  - Repro: `docker buildx imagetools inspect ghcr.io/garudex-labs/caracal-coordinator:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-audit:v2026.05.14` (ghcr/docker/-): image SLSA provenance found
  - Repro: `docker buildx imagetools inspect ghcr.io/garudex-labs/caracal-audit:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-gateway:v2026.05.14` (ghcr/docker/-): image SLSA provenance found
  - Repro: `docker buildx imagetools inspect ghcr.io/garudex-labs/caracal-gateway:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-sts:v2026.05.14` (ghcr/docker/-): image SLSA provenance found
  - Repro: `docker buildx imagetools inspect ghcr.io/garudex-labs/caracal-sts:v2026.05.14`
- **[info]** PASS — `ghcr.io/garudex-labs/caracal-redis:v2026.05.14` (ghcr/docker/-): image SLSA provenance found
  - Repro: `docker buildx imagetools inspect ghcr.io/garudex-labs/caracal-redis:v2026.05.14`

### Docs & Examples

- **[major]** FAIL — `lynxCapital` (linux-amd64/pnpm/-): 
  - Repro: `pnpm install`


## Highest priority fixes

1. **[major]** `lynxCapital` — 

## Sign-off

- [ ] Compatibility matrix matches GitHub Release assets
- [ ] Registry metadata reviewed
- [ ] PyPI install matrix green
- [ ] npm install matrix green
- [ ] CLI / TUI binaries verified on all platforms
- [ ] Installers verified
- [ ] Containers boot cleanly
- [ ] Provenance verified
- [ ] Examples run against released packages
