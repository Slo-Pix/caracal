# packages/core/python

## Scope
- Covers the `caracalai-core` Python package under `packages/core/python/`.

## Architecture Design
- The package provides Python audit, errors, JSON types, logging/redaction, and scope primitives.
- It is dependency-free and supports other Python packages in this repository.

## Required
- Must require Python 3.14+ through `pyproject.toml`.
- Must keep the public surface exported from `caracalai_core/__init__.py`.
- Must keep logging redaction centralized and deterministic.
- Must keep primitives framework-neutral.

## Forbidden
- Must not depend on FastAPI, httpx, Redis, Postgres, JWT, or transport packages.
- Must not include service-specific logic.
- Must not print logs or secrets during import.

## Validation
- Validate with the relevant `tests/python/unit/caracalai_core` tests.

