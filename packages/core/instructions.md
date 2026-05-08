# core

## Scope
- Covers the cross-cutting Caracal core foundation under `caracal/packages/core/`; language implementations live in subdirectories.

## Required
- Must contain only language subdirectories (`ts/`, `go/`) plus this file.
- Each language subdirectory must own its own manifest (`package.json`, `go.mod`, etc.) and its own `instructions.md`.

## Forbidden
- Must not contain source files at this level.
- Must not introduce cross-language imports between subdirectories.
- Must not duplicate rules from child directories.
