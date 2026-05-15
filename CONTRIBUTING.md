# Contributing to Caracal

## Prerequisites

| Tool                | Version | Required for                |
| ------------------- | ------- | --------------------------- |
| Node.js             | 24+     | All work                    |
| pnpm                | 10+     | All work                    |
| Docker + Compose v2 | 24+     | Running the stack           |
| Go                  | 1.26+   | Go services / packages      |
| Python              | 3.11+   | Python packages             |
| Bun                 | latest  | Building CLI / TUI binaries |

Throughout this doc:

- `<os>` ∈ `linux` · `darwin` · `windows`
- `<arch>` ∈ `x64` · `arm64` (Windows: `x64` only; binary has a `.exe` suffix)

## Modes: dev vs runtime

Every artifact is bound to one of two modes at build time.

|                       | Dev                                                      | Runtime                                                     |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `caracal --version`   | `2026.05.14+dev.<sha> [dev (sha …)]`                     | `v2026.05.14 [runtime]` (CI) / `dev-<sha> [runtime]` (local)|
| Container images      | `localhost/caracal-{svc}:dev-<sha>` (built locally)      | `ghcr.io/garudex-labs/caracal-{svc}:v<calver>` (CI) / `localhost/caracal-{svc}:dev-<sha>` (local) |
| Compose file          | `infra/docker/docker-compose.yml`                        | embedded in CLI, installed to the Caracal runtime home (`~/.local/share/caracal/` on Linux, `~/Library/Application Support/caracal/` on macOS) |
| `INSECURE_*` env vars | honored                                                  | refused; services panic on startup                          |

The base CalVer is centralized in `packages/engine/runtime/release.json` (consumed by `stampDev`). Release CI must pass `CARACAL_RELEASE_VERSION=v<calver>` explicitly; without it, `build:release` produces a developer-local binary that targets `localhost/caracal-<svc>:dev-<sha>` instead of pulling from GHCR.


## Setup

```bash
git clone https://github.com/Garudex-Labs/caracal.git && cd caracal
pnpm install
pnpm caracal up                                  # Starts the full stack
pnpm caracal zone create --name dev              # provision your first zone (returns the id)
pnpm caracal app create --zone <id> --name cli   # provision an application (returns the client secret)
# author caracal.toml with zone_id, application_id, app_client_secret, zone_url
```

Caracal ships no pre-seeded fixtures; the database starts empty in every mode. Operators (or your IaC) own zone/application/resource/policy provisioning through the regular `/v1/*` admin endpoints — the same path used in production.

The first `caracal up` auto-generates `infra/docker/.env` and the secret files
under `infra/secrets/files/` (both gitignored). Re-run `pnpm secrets:init`
explicitly only if you want to bootstrap credentials without starting the stack.

Drop the `pnpm` prefix with `pnpm link --global` (undo with `pnpm unlink --global caracal`).

## Stack Commands

```bash
pnpm caracal up                     # build + start the stack (dev rebuilds; runtime pulls images)
pnpm caracal down [-v]              # stop (-v wipes volumes)
pnpm caracal status                 # /health probe every service
pnpm caracal zone create --name <n> # provision a zone (returns id)
pnpm caracal app  create --name <n> # provision an application (returns client secret)
pnpm caracal purge [targets...]     # cleanup: stack/volumes/logs/config/runtime/cache
pnpm caracal run -- <cmd>           # run <cmd> with RESOURCE_TOKEN injected
pnpm caracal credential read <res>  # resolve a credential
pnpm caracal --help
```

## Development

### CLI

```bash
pnpm --dir apps/cli dev
pnpm --dir apps/cli typecheck
```

### TUI

Stack must be up and provisioned first. Then run from the repo root:

```bash
pnpm caracal-tui
```

## Tests

```bash
pnpm test                                    # full suite (ts + go + py)
pnpm run test:typescript | test:go | test:python
```

`scripts/testCi.sh` mirrors `.github/workflows/test.yml` locally:

```bash
scripts/testCi.sh                # full suite (ts + go + py + docs)
scripts/testCi.sh --smoke | --go | --py | --ts
```

## Submitting Changes

1. Branch off `main`. Keep commits focused.
2. Add a changeset for any change to a published package: `pnpm changeset`.
3. If you touched API / STS / CLI, smoke-test end-to-end: `pnpm caracal up && pnpm caracal zone create --name dev && pnpm caracal app create --zone <id> --name cli && pnpm caracal run -- printenv RESOURCE_TOKEN` (write `caracal.toml` between steps 3 and 4 with the returned ids/secret).
4. `pnpm test` must pass.

## Building Binaries

`bun build --compile` produces self-contained executables (no Node / Bun on the target).

```bash
pnpm --dir apps/cli sync-embedded            # CLI only; required before `build:<os>-<arch>`
pnpm --dir apps/<cli|tui> build              # all targets for that app
pnpm --dir apps/<cli|tui> build:<os>-<arch>  # single target
```

Output: `apps/<cli|tui>/dist/caracal[-tui]-<os>-<arch>[.exe]` (Windows binaries have the `.exe` suffix). The release workflow renames these into versioned archives; locally you work with the raw dist files.

## Releases

Release artifacts share one CalVer: `vYYYY.MM.DD` (suffix `.N` for same-day re-cuts). Only maintainers listed in `.github/MAINTAINERS` may cut releases.

### Test a release-style binary locally

Run from the repo root:

```bash
pnpm --dir apps/cli build:release                          # stamp runtime + build local images + bun compile (all targets)
pnpm --dir apps/tui build:release                          # stamp runtime + bun compile (all targets)
BIN="$(pwd)/apps/cli/dist/caracal-cli-<os>-<arch>"         # absolute path; survives cd
TUI="$(pwd)/apps/tui/dist/caracal-tui-<os>-<arch>"         # TUI binary; same OS/arch matrix
pnpm caracal down                                          # Stop dev to test runtime
"$BIN" --version                                           # → caracal dev-<sha> [runtime]
"$TUI" --version                                           # → caracal-tui dev-<sha> [runtime]
(cd /tmp && "$BIN" up && "$BIN" status && "$TUI" && "$BIN" down)
```

The local `build:release` stamps the binary with `CARACAL_VERSION=dev-<sha>` and `CARACAL_REGISTRY=localhost/`, then runs `docker compose build` to produce `localhost/caracal-{svc}:dev-<sha>` for each service. The release-style binary resolves to those images — no GHCR pull, no auth, fully reproducible from your checkout. The TUI variant stamps `CARACAL_TUI_VERSION` / `CARACAL_TUI_MODE=runtime` and shares the same engine-installed runtime assets.

### Cutting a release

```bash
scripts/release.sh               # applies changesets, computes CalVer, tags, pushes
scripts/release.sh --dry-run     # preview without tagging
```

Pushing the tag triggers `.github/workflows/release.yml`, which produces:

- 10 archives (5 CLI + 5 TUI), `SHA256SUMS`, SLSA provenance
- 5 multi-arch GHCR images with provenance + SBOM, tagged `v<calver>` and `vYYYY.MM`
- A GitHub Release with archives, `SHA256SUMS`, `install.sh`, `install.ps1`

### Post-release validation

`postReleaseValidation.yml` runs automatically after `release.yml` succeeds (or trigger with `gh workflow run postReleaseValidation.yml -f release=v2026.05.14`). It exercises registries, archives, installers, containers, and provenance, then opens a PR with `releases/<tag>/validation.md`.

Reproduce one area locally:

```bash
CARACAL_RELEASE=v2026.05.14 FINDINGS_DIR=/tmp/findings \
  bash scripts/postRelease/validateRegistryMetadata.sh
```

### Publishing to npm and PyPI

```bash
./scripts/publishNpm.sh
./scripts/publishPypi.sh             # PyPI
./scripts/publishPypi.sh --testpypi   # TestPyPI
```

Skips versions already published. Both scripts refuse to publish dev-stamped versions (`+dev.<sha>` / `-dev.<sha>`).

### Published artifacts

```
npm:    @caracalai/{core,oauth,admin,identity,revocation,sdk,
                    transport-mcp,transport-a2a,
                    mcp-express,mcp-fastmcp,tokenstate-postgres,revocation-redis}
pypi:   caracalai-{core,identity,revocation,sdk,transport-mcp,mcp-fastmcp,revocation-redis}
ghcr:   ghcr.io/garudex-labs/caracal-{api,sts,gateway,audit,coordinator,redis}
```

Browse: [npm](https://www.npmjs.com/~caracal-run) · [PyPI](https://pypi.org/user/CaracalAI).

### Rollback

Never delete a published tag. Roll forward with a new CalVer tag. The floating `vYYYY.MM` image tag moves with the new cut; pinned `v<calver>` tags are immutable.

## Security

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## License

Apache-2.0. By contributing you agree your contribution is licensed under the same terms ([LICENSE](LICENSE)).
