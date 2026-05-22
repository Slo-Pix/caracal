---
description: "Use when changing Caracal commands, package scripts, CLI/TUI surfaces, shell launchers, command catalogs, completions, or command documentation. Enforces the runtime-script versus product-management boundary."
applyTo: "{package.json,apps/cli/**,apps/tui/**,packages/engine/src/commands.ts,packages/engine/src/dispatch.ts,docs/**,README.md,CONTRIBUTING.md}"
---

# Command Architecture

- Top-level `caracal` shell commands must only manage local runtime lifecycle and setup: start, stop, status, purge, and optional interface launchers.
- Top-level package scripts must not provide product-management aliases for zones, policies, grants, Control credentials, audit, agents, delegation, or other admin workflows.
- Product management commands must live only in CLI/TUI surfaces and their shared engine/admin helpers.
- CLI and TUI must expose the same product capabilities with matching names, lifecycle behavior, terminology, and engine integration.
- CLI and TUI launchers must remain optional; top-level help, completions, and dispatch must hide a launcher when its binary or workspace shim is unavailable.
- If only CLI or only TUI is available, the top-level shell must still expose available lifecycle commands and the available interface launcher.
- Control API management is a CLI/TUI product-management surface; it must not be exposed as a top-level runtime command or recursively through remote Control dispatch.
- Runtime lifecycle code must not require admin tokens, zone selection, product credentials, or Control credentials.
- Command documentation must show runtime lifecycle examples through `caracal` and product-management examples through `caracal cli`, `caracal-cli`, or the TUI.
