# tui

## Scope
- Covers only the `caracal-tui` interactive terminal UI under `caracal/apps/tui/`.

## Required
- Must run on Node 24+ via `bin/caracal-tui.mjs`; release artifacts are produced via `bun build --compile` for linux/darwin/windows × x64/arm64.
- Must use `@caracalai/admin` for every API and coordinator call; must not duplicate route paths or schemas.
- Must require `CARACAL_ADMIN_TOKEN` for all admin views and exit with a clear message when missing; must require `CARACAL_COORDINATOR_TOKEN` only for the agents view and surface a status-bar error when it is missing.
- Must resolve `CARACAL_API_URL`, `CARACAL_COORDINATOR_URL`, `CARACAL_ZONE_ID`, and `caracal.toml` (cwd / `$PWD` / `$INIT_CWD` / `$XDG_CONFIG_HOME/caracal/caracal.toml`) using the same precedence as the CLI.
- Must render in the alternate screen buffer with hidden cursor and restore terminal state on exit, SIGINT, or fatal error.
- Must support j/k or ↑/↓ navigation, Enter to drill in, h/← or Esc to go back, r to reload, q or Ctrl-C to quit, and 0–9 hot-keys for menu items.
- Must implement views for: zones, applications, resources, providers, policies, policy-sets, grants, sessions, audit (live tail with decision filter and pause), and agents.
- Must keep the audit view's polling cancellable: `dispose()` must clear timers when the view leaves the stack.
- Must refuse to launch when stdin is not a TTY.

## Forbidden
- Must not import from `caracalEnterprise/`.
- Must not write secrets, tokens, or refresh tokens to disk.
- Must not depend on a Bun runtime at execution time.
- Must not pull a heavyweight UI framework (React, Ink, blessed, etc.); the TUI is implemented with `node:tty`/`node:readline` plus ANSI escapes only.
- Must not perform mutating admin operations from the TUI; mutation flows live in the CLI.
