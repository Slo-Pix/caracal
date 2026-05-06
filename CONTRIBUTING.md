# Contributing to Caracal

Thank you for your interest in Caracal. This guide covers what you need to develop, test, and submit changes.

## Prerequisites

- Node 24+
- pnpm 10
- Docker Compose v2
- Go 1.26 (only required when changing Go services or shared Go packages)
- Python 3.11+ (only required when changing the Python MCP package)
- Bun (only required to build distributable CLI binaries via `bun build --compile`)

## Setup

```bash
git clone https://github.com/Garudex-Labs/caracal.git
cd caracal
pnpm install
cp infra/docker/.env.example infra/docker/.env
pnpm caracal up
pnpm caracal init
```

`caracal up` builds and starts the full local stack (postgres, redis, init, sts, api, gateway, audit, coordinator). The API applies database migrations on boot. `caracal init` provisions the local zone via `POST /v1/local/bootstrap` and writes `caracal.toml` in the repo root (or `~/.config/caracal/caracal.toml` if no local file exists) with a freshly generated client secret.

### Skip the `pnpm` prefix

All `pnpm caracal <cmd>` invocations below can be shortened to bare `caracal <cmd>` after linking the CLI globally once:

```bash
pnpm link --global
```

To unlink: `pnpm unlink --global caracal`.

## Repository Layout

- `apps/api` — admin / management plane (Fastify, TypeScript)
- `apps/cli` — `caracal` command (TypeScript, Node 24, optional Bun build)
- `apps/tui` — `caracal-tui` interactive terminal UI (TypeScript, Node 24, optional Bun build)
- `services/sts`, `services/gateway`, `services/audit` — Go services
- `apps/agent-coordinator` — TypeScript coordinator with embedded Go relay
- `packages/shared` — shared Go libraries
- `packages/ts-shared` — shared TypeScript helpers (internal)
- `packages/caracalai-*` — public SDKs (TypeScript, Go, Python)
- `infra/docker` — Compose orchestration; `infra/postgres/migrations` — SQL migrations applied by the API at boot
- `tests/{typescript,go,python,shared}` — co-located test trees

## Stack Commands

```bash
pnpm caracal up              # Build images and start all services
pnpm caracal up --build      # Force rebuild even with cached layers
pnpm caracal down            # Stop all services
pnpm caracal down -v         # Stop and wipe all volumes (fresh state)
pnpm caracal status          # Probe /health on every service
pnpm caracal init            # Provision local zone and write caracal.toml
pnpm caracal init --force    # Re-provision and rotate the client secret
pnpm caracal --help          # Show all commands and options
```

Run a command with `RESOURCE_TOKEN` injected (useful for testing MCP flows):

```bash
pnpm caracal run -- printenv RESOURCE_TOKEN
pnpm caracal run -- node -e 'console.log(process.env.RESOURCE_TOKEN)'
```

Read a resolved credential:

```bash
pnpm caracal credential read <resource-name>
```

## Terminal UI (`apps/tui`)

A read-only TUI lives alongside the CLI for interactively inspecting zones, applications, resources, providers, policies, policy-sets, grants, sessions, agents, and a live audit tail. Mutation flows stay in the CLI.

### Run from the repo

The TUI is a workspace package (`@caracalai/tui`). After `pnpm install`:

```bash
# 1. Stack must be running and provisioned
pnpm caracal up
pnpm caracal init

# 2. Export the admin token (read it back from the local env file)
export CARACAL_ADMIN_TOKEN=$(grep ^CARACAL_ADMIN_TOKEN infra/docker/.env | cut -d= -f2)

# 3. Launch via Node 24 native type-stripping
node apps/tui/bin/caracal-tui.mjs
# or, equivalently:
pnpm --filter @caracalai/tui dev
```

### Configuration

The TUI shares the CLI's resolution chain.

| Variable                      | Default                  | Required for                        |
| ----------------------------- | ------------------------ | ----------------------------------- |
| `CARACAL_ADMIN_TOKEN`         | —                        | every view; refuses to launch otherwise |
| `CARACAL_API_URL`             | `http://localhost:3000`  | all admin views                     |
| `CARACAL_COORDINATOR_URL`     | `http://localhost:4000`  | the agents view                     |
| `CARACAL_COORDINATOR_TOKEN`   | —                        | the agents view                     |
| `CARACAL_ZONE_ID`             | `zone_id` from `caracal.toml` | every zone-scoped view         |

`caracal.toml` is discovered the same way as in the CLI: `$CARACAL_CONFIG`, then cwd / `$PWD` / `$INIT_CWD/caracal.toml`, then `$XDG_CONFIG_HOME/caracal/caracal.toml`.

### Key bindings

| Key                  | Action                                  |
| -------------------- | --------------------------------------- |
| `0`–`9`              | Open menu item by number                |
| `j` / `k` or `↑`/`↓` | Move cursor                             |
| `Enter`              | Drill into the selected row             |
| `h` / `←` / `Esc`    | Go back one view                        |
| `r`                  | Reload the current view                 |
| `g` / `G`            | Jump to top / bottom                    |
| `p`                  | Pause / resume audit tail               |
| `d`                  | Cycle audit decision filter             |
| `z`                  | Pick zone (from the menu)               |
| `q` / `Ctrl-C`       | Quit (restores terminal)                |

### Tests, typecheck, build

```bash
pnpm --filter @caracalai/tui typecheck
pnpm --filter @caracalai/tui test
pnpm --filter @caracalai/tui build      # bun build --compile, all 5 targets
```

The TUI is implemented with `node:tty` + ANSI escapes only — no React, Ink, or blessed. Lifecycle is `App` → view stack with `init(app)` / `dispose()` hooks; the audit view's poll timer must be cleared in `dispose`. See [apps/tui/instructions.md](apps/tui/instructions.md) for the full directory contract.

End users get the TUI via `install.sh` / `install.ps1` (set `CARACAL_SKIP_TUI=1` to opt out). Release builds five `caracal-tui-*` binaries alongside the CLI binaries — see the Releases section below.

Per-directory rules live in each directory's `instructions.md`. Read those before making changes inside a directory.

## Tests

Run the full suite:

```bash
pnpm test
```

Run a single layer:

```bash
pnpm run test:typescript
pnpm run test:go
pnpm run test:python
```

Per-package tests:

```bash
pnpm --dir apps/api test
pnpm --dir apps/cli test
pnpm --dir apps/tui test
go test ./services/sts/...
```

## Code Style

- File headers and naming conventions are enforced by the rules in `.claude/rules/` and `.github/instructions/`.
- One current implementation per feature — no fallback paths, no compatibility shims, no commented-out code.
- Don't add abstractions, helpers, or features beyond what a change requires.
- Match the surrounding code's level of abstraction and naming style.

## Submitting Changes

1. Create a topic branch off `main`.
2. Make focused commits; keep unrelated cleanups separate.
3. Run `pnpm test` and confirm `pnpm caracal up && pnpm caracal init && pnpm caracal run -- printenv RESOURCE_TOKEN` still succeeds end-to-end if your change touches the API, STS, or CLI.
4. Open a pull request describing the change, the affected directories, and any new instructions added.
5. Sign off with `git commit -s` if your change requires DCO.

## Security

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md) for the disclosure process.

## Releasing

Releases are fully automated by [`.github/workflows/release.yml`](.github/workflows/release.yml). To cut a release:

1. Confirm `main` is green.
2. Tag with semantic version: `git tag -a v0.1.1 -m "v0.1.1" && git push origin v0.1.1`.
3. The workflow runs `pnpm test`, then in parallel:
   - Stamps `apps/cli/src/runtime/version.ts` and `apps/cli/package.json` with the tag, regenerates `src/runtime/embedded.ts` via the `prebuild` hook, and builds five CLI binaries plus five matching `caracal-tui-*` binaries with `bun build --compile` (linux/darwin × x64/arm64 and windows-x64).
   - Builds and pushes five multi-arch (linux/amd64, linux/arm64) container images to GHCR with provenance + SBOM: `ghcr.io/garudex-labs/caracal-{api,sts,gateway,audit,coordinator}` tagged `vX.Y.Z`, `vX.Y`, and `latest`.
4. A GitHub Release is created with auto-generated notes and attaches every binary (CLI + TUI), `SHA256SUMS`, `install.sh`, and `install.ps1`.

End users install via `curl -fsSL https://raw.githubusercontent.com/Garudex-Labs/caracal/main/install.sh | sh`. Pin a version with `CARACAL_VERSION=v0.1.1` before the pipe.

Versioning policy: semver. Bump major on breaking CLI flags, API contracts, or compose service interfaces; minor for additive features; patch for bug fixes.

To preview the bundled runtime assets locally without releasing: `pnpm --dir apps/cli sync-embedded`.

## License

Caracal is Apache-2.0. By contributing you agree that your contribution is licensed under the same terms (see [LICENSE](LICENSE)).
