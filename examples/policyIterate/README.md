# Policy Iterate

Turns a **denied request** into a **reproducible policy-set simulation**, so a
team can fix a policy from real audit data instead of guessing.

The Caracal audit explain endpoint reconstructs a redaction-safe `policy_input`
for each denied decision. This example takes that input and simulates it against
a candidate policy-set version, then tells you whether the candidate would now
allow the request.

## Loop

1. A real request is denied. You have its `request_id` from audit.
2. `explain` returns the reconstructed `policy_input` for the denial.
3. Edit the policy and stage it as a new (not yet active) policy-set version.
4. Simulate the denied input against that candidate version.
5. Activate only when the simulation returns `allow`.

## Run

```bash
cd examples/policyIterate
CARACAL_API_URL=http://127.0.0.1:3000 \
CARACAL_ADMIN_TOKEN=<admin-token> \
CARACAL_ZONE_ID=<zone-id> \
PREFLIGHT_REQUEST_ID=<denied-request-id> \
CANDIDATE_POLICY_SET_ID=<policy-set-id> \
CANDIDATE_POLICY_SET_VERSION_ID=<staged-version-id> \
node run.mjs
```

Exit code `0` means the candidate version allows the previously denied request.

## Note on claims

Actor and subject claims are never written to audit, so the reconstructed input
does not contain them. For a claim-dependent denial, add the relevant
`context.actor_claims` to the printed input before simulating.

## Test

```bash
node --test
```

Tests are fully offline: the Admin API transport is injected.
