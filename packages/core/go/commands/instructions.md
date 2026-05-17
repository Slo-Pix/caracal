# packages/core/go/commands

## Scope
- Covers the Go command catalog mirror under `packages/core/go/commands/`.

## Architecture Design
- This package describes command and subcommand shape for Go consumers such as the control service.
- The TypeScript catalog in `packages/core/ts/src/commands.ts` is the canonical source.

## Required
- Must mirror command names, groups, subcommands, and hidden flags from the TypeScript catalog.
- Must keep catalog data declarative.
- Must preserve parity coverage through existing catalog tests.

## Forbidden
- Must not add command execution, flag parsing, defaults, or argument schemas.
- Must not diverge from the TypeScript catalog.

## Validation
- Validate with `go test ./packages/core/go/commands` and `pnpm test -- --run tests/typescript/scripts/catalog-parity.test.ts` when the catalog changes.

