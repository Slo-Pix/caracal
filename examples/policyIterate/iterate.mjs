/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Closes the policy iterate loop by turning a denied request into a reproducible policy-set simulation.
*/

// pickDeniedInput returns the reconstructed policy_input from the first denied
// entry of a decision trace, or null when the request was not denied.
export function pickDeniedInput(trace) {
  if (!trace || !Array.isArray(trace.denied) || trace.denied.length === 0) return null
  const denied = trace.denied[0]
  return denied.policy_input ?? null
}

// summarizeTrace flattens the denied entries into a readable diagnosis.
export function summarizeTrace(trace) {
  const denied = Array.isArray(trace?.denied) ? trace.denied : []
  return {
    requestId: trace?.request_id ?? null,
    finalDecision: trace?.final_decision ?? 'unknown',
    reasons: denied.flatMap((entry) =>
      (Array.isArray(entry.diagnostics) ? entry.diagnostics : []).map((d) => d.reason ?? JSON.stringify(d)),
    ),
    determiningPolicies: denied.flatMap((entry) =>
      (Array.isArray(entry.determining_policies) ? entry.determining_policies : []).map((p) => p.policy ?? JSON.stringify(p)),
    ),
  }
}

// iterate runs the loop: explain a denied request, extract its policy_input, and
// simulate that input against a candidate policy-set version. The transport is
// injected so the orchestration is testable offline.
export async function iterate({ transport, requestId, policySetId, candidateVersionId }) {
  const trace = await transport.explain(requestId)
  const input = pickDeniedInput(trace)
  if (!input) {
    return { reproduced: false, trace: summarizeTrace(trace), simulation: null }
  }
  const simulation = await transport.simulate(policySetId, candidateVersionId, input)
  const decision = simulation?.result?.decision ?? 'unknown'
  return {
    reproduced: true,
    trace: summarizeTrace(trace),
    policyInput: input,
    simulation: {
      decision,
      wouldActivate: simulation?.would_activate ?? false,
      warnings: simulation?.warnings ?? [],
      diagnostics: simulation?.result?.diagnostics ?? [],
    },
    fixed: decision === 'allow',
  }
}
