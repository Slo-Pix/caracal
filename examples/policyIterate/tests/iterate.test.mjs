/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Offline tests for the policy iterate loop.
*/

import assert from "node:assert/strict"
import { test } from "node:test"
import { iterate, pickDeniedInput, summarizeTrace } from "../iterate.mjs"

const deniedTrace = {
  request_id: "r1",
  final_decision: "deny",
  denied: [
    {
      event_id: "a1",
      diagnostics: [{ reason: "no_matching_policy" }],
      determining_policies: [{ policy: "baseline-scope-allowlist" }],
      metadata: { resource: "resource://pipernet" },
      policy_input: {
        schema_version: "2026-05-20",
        principal: { type: "Application", id: "app-1", zone_id: "z1" },
        resource: { type: "Resource", identifier: "resource://pipernet", scopes: ["pipernet:read"] },
        action: { id: "TokenExchange" },
        context: { actor_claims: {}, requested_scopes: ["pipernet:read"], challenge_resolved: false },
      },
    },
  ],
}

const allowTrace = { request_id: "r2", final_decision: "allow", denied: [] }

test("pickDeniedInput returns the reconstructed input", () => {
  assert.equal(pickDeniedInput(deniedTrace).principal.id, "app-1")
  assert.equal(pickDeniedInput(allowTrace), null)
})

test("summarizeTrace flattens reasons and policies", () => {
  const summary = summarizeTrace(deniedTrace)
  assert.deepEqual(summary.reasons, ["no_matching_policy"])
  assert.deepEqual(summary.determiningPolicies, ["baseline-scope-allowlist"])
})

test("iterate reports fixed when the candidate version allows", async () => {
  const transport = {
    explain: async () => deniedTrace,
    simulate: async (_setId, _versionId, input) => {
      assert.equal(input.principal.id, "app-1")
      return { would_activate: true, warnings: [], result: { decision: "allow", diagnostics: [] } }
    },
  }
  const report = await iterate({ transport, requestId: "r1", policySetId: "ps1", candidateVersionId: "v2" })
  assert.equal(report.reproduced, true)
  assert.equal(report.fixed, true)
  assert.equal(report.simulation.decision, "allow")
})

test("iterate reports not fixed when the candidate version still denies", async () => {
  const transport = {
    explain: async () => deniedTrace,
    simulate: async () => ({ would_activate: false, warnings: [], result: { decision: "deny", diagnostics: [{ reason: "no_matching_policy" }] } }),
  }
  const report = await iterate({ transport, requestId: "r1", policySetId: "ps1", candidateVersionId: "v2" })
  assert.equal(report.fixed, false)
})

test("iterate reports not reproduced when the request was not denied", async () => {
  const transport = { explain: async () => allowTrace, simulate: async () => { throw new Error("should not simulate") } }
  const report = await iterate({ transport, requestId: "r2", policySetId: "ps1", candidateVersionId: "v2" })
  assert.equal(report.reproduced, false)
  assert.equal(report.simulation, null)
})
