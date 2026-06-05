# _mock/providerlab

## Scope
- Covers the provider mock lab under `examples/lynxCapital/_mock/providerlab/`.

## Required
- Must represent every Caracal provider auth category with exactly two providers in `catalog.py`.
- Must keep `taxonomy_complete()` true at all times.
- Must serve each provider only on `127.0.0.1` on its catalog port.
- Must use third-party industry field names (`clientId`, `clientSecret`, `apiKey`, `accessToken`) on every wire surface.
- Must seed one canonical credential per provider on first start and persist it under `_store/`.
- Must support create, validate, and revoke for every credential type a provider issues.
- Must reject calls exactly as the matching real provider would, with provider-shaped error bodies.
- Must apply external-feel behavior (request id, latency, rate limit, faults) through `netsim.py`.
- Must honor `PROVIDERLAB_FAST=1` to disable latency and fault injection.
- Must keep provider SDK shims under `_mock/sdk/`.

## Forbidden
- Must not use Caracal-internal type or field names on any provider wire surface.
- Must not bind any provider to a non-loopback interface in `run.py` or `server.py`.
- Must not commit anything under `_store/`.
- Must not reference application code in `app/` from any lab module.
- Must not add a real Caracal SDK dependency or runtime call.

## Validation
- Validate with `PROVIDERLAB_FAST=1 pytest tests/test_providerlab.py` from `examples/lynxCapital/`.
