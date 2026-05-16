# Contributing to Caracal

<details>
<summary>Prerequisites</summary>

| Tool                | Version |
| ------------------- | ------- |
| Node.js             | 24+     |
| pnpm                | 10+     |
| Docker + Compose v2 | 24+     |
| Go                  | 1.26+   |
| Python              | 3.11+   |
| Bun                 | latest  |

- `<os>` ∈ `linux` · `darwin` · `windows`
- `<arch>` ∈ `x64` · `arm64`

</details>

<details>
<summary>Modes</summary>

|                       | Dev                                                      | Runtime                                                     |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| `caracal --version`   | `2026.05.14+dev.<sha> [dev (sha …)]`                     | `v2026.05.14 [runtime]` (Released) / `dev-<sha> [runtime]` (local)|
| Container images      | `localhost/caracal-{svc}:dev-<sha>` (built locally)      | `ghcr.io/garudex-labs/caracal-{svc}:v<calver>` (Released) / `localhost/caracal-{svc}:dev-<sha>` (local) |

</details>

## Setup

```bash
git clone https://github.com/Garudex-Labs/caracal.git && cd caracal
pnpm install
pnpm caracal up                     # Build and start the full stack

# Essential Commands
pnpm caracal --help                 # Show CLI help and available commands
pnpm caracal status                 # Check health status of all services
pnpm caracal down [--help]          # Stop the stack
pnpm caracal purge                  # Remove stack, volumes, logs, cache, and runtime data
```

<details>
<summary>Drop the `pnpm` prefix</summary>

```bash
pnpm link --global            # Install global symlink
pnpm unlink --global caracal  # Remove global symlink
```

</details>

#### CLI

```bash
pnpm caracal cli
pnpm --dir apps/cli typecheck
```

#### TUI

```bash
pnpm caracal-tui
```

CLI and TUI are exact alternatives over the same engine: every command available in one is available in the other. Both consume the canonical catalog at `packages/core/ts/src/commands.ts` (mirrored in Go at `packages/core/go/commands/catalog.go`; parity enforced by `tests/typescript/scripts/catalog-parity.test.ts`).

##### Parity contract

- Every entry in `CLI_COMMANDS` must have a CLI executor (`apps/cli/src/registry.ts`) and a TUI surface (`apps/tui/src/views/menu.ts`); the parity test fails the build otherwise.
- Catalog entries marked `hidden: true` (e.g. `completion`) are exempt from the TUI surface by design.
- Top-level shell verbs (`up`, `down`, `status`, `purge`) live in `SHELL_COMMANDS` and are dispatched only by the `caracal` wrapper binary. They are intentionally absent from `caracal-cli` and from the control API surface, which accept only `CLI_COMMANDS`.
- The control API (`/v1/control/invoke`) validates incoming `command`/`subcommand` against the same canonical catalog plus per-flag schema (primitives, strings, string arrays; bounded sizes).

#### Control API (optional)

The control service is an OAuth-protected HTTP API hosted by the engine — not a CLI command. It exposes `POST /v1/control/invoke` for any external client (script, AI agent, workflow, or another instance of CLI/TUI) that needs to drive Caracal programmatically. It is off by default.

```bash
docker compose --profile control up control   # start the surface (CONTROL_MODE=on)
```

Clients authenticate with a standard OAuth2 client-credentials flow against STS, scoped to `control:invoke`. Tokens are short-lived ES256 JWTs.

```bash
# mint a token (any OAuth2 client; CLI/TUI use their caracal.toml app creds)
curl -sX POST "$ZONE_URL/oauth/2/token" \
  -u "$APP_CLIENT_ID:$APP_CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=control:invoke" | jq -r .access_token

# invoke
curl -sH "Authorization: Bearer $TOKEN" \
  -d '{"command":"zone","subcommand":"list"}' \
  http://localhost:8087/v1/control/invoke
```

Key lifecycle (`caracal control …`) is the supported way to manage control-API credentials from CLI and TUI alike — `key`, `rotate`, and `revoke` subcommands wrap the engine's credential helpers and route through the admin API and STS so every change is audited on `caracal.audit.events`. Every accepted and rejected `/v1/control/invoke` request emits one `control.invoke` event; replay of a `jti` is rejected.

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
