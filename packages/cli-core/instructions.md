# cli-core

## Scope
- Covers the `@caracalai/cli-core` package: verb bodies shared by the Caracal CLI and TUI.

## Required
- Each verb must be a pure async function that accepts a typed options object and returns the unformatted admin response.
- Throw `AdminApiError` (or other plain `Error`s) on failure.
- Streaming verbs must accept an `onLine: (line: string) => void` callback and return a `{ dispose }` handle.
- Positional CLI arguments and option flags must surface as fields on the typed options object — callers do all flag parsing.
- Token-bearing strings written through the package must pass through `scrubTokens`.

## Forbidden
- Must not parse argv or flags.
- Must not write to stdout, stderr, or the terminal.
- Must not call `process.exit`.
- Must not import from `apps/` or any CLI/TUI-specific runtime layer.
- Must not embed credentials or read disk state outside what verbs explicitly request.
