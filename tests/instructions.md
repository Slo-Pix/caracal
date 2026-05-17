# tests

## Scope
- Covers centralized tests under `tests/`.

## Architecture Design
- Tests are organized by language, then test type, then component.
- Shared fixtures, mocks, test data, and reusable helpers live under `tests/shared/`.
- Package, app, and service manifests point their test commands at these centralized paths.

## Required
- Must place TypeScript tests under `tests/typescript/<type>/<component>/`.
- Must place Go tests under `tests/go/<type>/<component>/`.
- Must place Python tests under `tests/python/<type>/<component>/`.
- Must keep shared fixtures in `tests/shared/fixtures`, mocks in `tests/shared/mocks`, data in `tests/shared/test-data`, and helpers in `tests/shared/test-utils`.
- Must update the owning package, app, or service test command when adding a new component test path.

## Forbidden
- Must not add new test source files under `apps/`, `packages/`, `services/`, or `infra/` unless the language tool requires colocated tests already present in that module.
- Must not mix languages in one test file.
- Must not store production source code or generated coverage output here.

## Validation
- Validate with the narrow language/component test command declared by the owning manifest.
