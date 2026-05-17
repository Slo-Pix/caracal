# packages/engine/src

## Scope
- Covers source modules for `@caracalai/engine` under `packages/engine/src/`.

## Architecture Design
- Each module owns one execution concern or command noun.
- `index.ts` re-exports the package surface; module-internal helpers stay private.

## Required
- Must keep verb bodies independent of CLI flag parsing and terminal rendering.
- Must accept typed options objects instead of positional command-line state.
- Must keep generated `embedded.ts` produced by the build script.
- Must preserve token scrubbing on any user-visible string path.

## Forbidden
- Must not import from `apps/cli` or `apps/tui`.
- Must not write to stdout, stderr, or terminal APIs.
- Must not call `process.exit`.

## Validation
- Validate with `pnpm --dir packages/engine build` after source changes.

