# caracalai-revocation

Revocation lookup interface and in-memory default for Caracal resource servers.

Part of [Caracal](https://github.com/Garudex-Labs/caracal) — a security-first authority and delegation system for AI agents.

## Install

```bash
pip install caracalai-revocation
```

## Production contract

The in-memory store is process-local and intended for tests, local development, and single-process deployments. Distributed production deployments should use a connector-backed store and fail closed when revocation cannot be checked or writes cannot be confirmed.

## Links

- Source: https://github.com/Garudex-Labs/caracal
- Docs: https://caracal.run
- License: Apache-2.0
