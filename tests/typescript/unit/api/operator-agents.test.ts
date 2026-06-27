// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the Operator agents: intent routing, planning, and explanation.

import { describe, it, expect, vi } from 'vitest'
import {
  buildPlannerMessages,
  buildExplainerMessages,
  buildSecurityAnalystMessages,
  buildTriageMessages,
  runTriage,
  tierPlans,
  tierReadsState,
  tierComposes,
  runPlanner,
  runExplainer,
  runSecurityAnalyst,
} from '../../../../apps/api/src/operator-agents.js'
import type { Gateway, CompletionResult, CompletionObjectResult } from '../../../../apps/api/src/operator-gateway.js'

// A gateway stub whose free-text completions are scripted, so the explainer's prompt
// construction and output handling are exercised without a live model.
function gatewayReturning(...texts: string[]): { gateway: Gateway; complete: ReturnType<typeof vi.fn> } {
  const complete = vi.fn()
  for (const text of texts) {
    complete.mockResolvedValueOnce({ text, provider: 'test', model: 'm' } satisfies CompletionResult)
  }
  return {
    gateway: { status: () => ({ enabled: true, providers: [] }), complete } as unknown as Gateway,
    complete,
  }
}

// A gateway stub whose structured completions are scripted: a value resolves as the
// schema-validated object, while an Error rejects as the SDK would on an off-schema
// answer, so the router and planner are exercised against both real outcomes.
function gatewayProducing(...results: (object | Error)[]): { gateway: Gateway; completeObject: ReturnType<typeof vi.fn> } {
  const completeObject = vi.fn()
  for (const result of results) {
    if (result instanceof Error) {
      completeObject.mockRejectedValueOnce(result)
    } else {
      completeObject.mockResolvedValueOnce({ value: result, provider: 'test', model: 'm' } satisfies CompletionObjectResult<object>)
    }
  }
  return {
    gateway: { status: () => ({ enabled: true, providers: [] }), completeObject } as unknown as Gateway,
    completeObject,
  }
}

describe('runTriage', () => {
  it('returns the classified tier', async () => {
    const { gateway } = gatewayProducing({ tier: 'change' })
    expect(await runTriage(gateway, 'connect github')).toEqual({ ok: true, value: 'change' })
  })

  it('classifies a read question into the read tier', async () => {
    const { gateway } = gatewayProducing({ tier: 'read' })
    expect(await runTriage(gateway, 'what providers do I have')).toEqual({ ok: true, value: 'read' })
  })

  it('fails closed when classification does not pass the schema', async () => {
    const { gateway } = gatewayProducing(new Error('schema validation failed'))
    const result = await runTriage(gateway, 'hmm')
    expect(result.ok).toBe(false)
  })
})

describe('tierPlans', () => {
  it('plans only for change and compound tiers', () => {
    expect(tierPlans('change')).toBe(true)
    expect(tierPlans('compound')).toBe(true)
    expect(tierPlans('conversational')).toBe(false)
    expect(tierPlans('read')).toBe(false)
  })
})

describe('buildTriageMessages', () => {
  it('names every tier so the model classifies into the smallest sufficient one', () => {
    const system = buildTriageMessages('hello')[0].content
    expect(system).toContain('conversational')
    expect(system).toContain('read')
    expect(system).toContain('change')
    expect(system).toContain('compound')
  })
})

describe('buildPlannerMessages', () => {
  it('grounds the planner with the capability catalog', () => {
    const messages = buildPlannerMessages('connect github', { facts: null, state: null })
    const system = messages[0].content
    expect(system).toContain('connectProvider')
    expect(system).toContain('createZone')
    // The effect classification is surfaced so the model cannot mislabel a step.
    expect(system).toContain('changes state')
  })

  it('includes prior context in the user turn', () => {
    const messages = buildPlannerMessages('do it', {
      facts: null,
      state: {
        latest_plan: null,
        pending_approval: false,
        recent_messages: [{ seq: 1, role: 'user', text: 'earlier message' }],
        last_error: null,
      },
    })
    expect(messages[1].content).toContain('earlier message')
  })

  it('renders compressed session facts including rejection memory', () => {
    const messages = buildPlannerMessages('do it', {
      facts: {
        decided_plans: [{ seq: 2, summary: 'old plan', decision: 'rejected', executed: false, steps_succeeded: 0, steps_failed: 0 }],
        rejected_capabilities: ['grantAccess'],
        applied_change_count: 3,
        last_error: null,
      },
      state: null,
    })
    const content = messages[1].content
    expect(content).toContain('Session facts')
    expect(content).toContain('Previously rejected operations')
    expect(content).toContain('grantAccess')
    expect(content).toContain('3 change(s) already applied')
  })
})

describe('buildExplainerMessages', () => {
  it('grounds the answer in live state evidence with names and counts', () => {
    const messages = buildExplainerMessages('what providers do i have', {
      facts: null,
      state: null,
      evidence: [
        { capability: 'listProviders', domain: 'provider', ok: true, count: 2, names: ['GitHub', 'Stripe'] },
        { capability: 'listResources', domain: 'resource', ok: true, count: 0, names: [] },
      ],
    })
    const content = messages[1].content
    expect(content).toContain('Live state (read just now)')
    expect(content).toContain('provider (2): GitHub, Stripe')
    expect(content).toContain('resource: none')
    // The system prompt instructs the model to ground in the live state and not invent entities.
    expect(messages[0].content).toContain('do not invent')
  })

  it('truncates the names list while keeping the live count', () => {
    const messages = buildExplainerMessages('list apps', {
      facts: null,
      state: null,
      evidence: [{ capability: 'listApplications', domain: 'application', ok: true, count: 9, names: ['a', 'b', 'c'] }],
    })
    expect(messages[1].content).toContain('application (9): a, b, c, …')
  })

  it('reports a read that could not be gathered without failing the answer', () => {
    const messages = buildExplainerMessages('what policies', {
      facts: null,
      state: null,
      evidence: [{ capability: 'listPolicies', domain: 'policy', ok: false, error: 'missing scope control:policy:read' }],
    })
    expect(messages[1].content).toContain('policy: could not read (missing scope control:policy:read)')
  })

  it('omits the live state block when no evidence was gathered', () => {
    const messages = buildExplainerMessages('what is a zone', { facts: null, state: null })
    expect(messages[1].content).not.toContain('Live state')
  })
})

describe('tierReadsState', () => {
  it('reads state only for the read tier', () => {
    expect(tierReadsState('read')).toBe(true)
    expect(tierReadsState('conversational')).toBe(false)
    expect(tierReadsState('change')).toBe(false)
    expect(tierReadsState('compound')).toBe(false)
  })
})

describe('tierComposes', () => {
  it('composes specialists only for the compound tier', () => {
    expect(tierComposes('compound')).toBe(true)
    expect(tierComposes('change')).toBe(false)
    expect(tierComposes('read')).toBe(false)
    expect(tierComposes('conversational')).toBe(false)
  })
})

describe('buildSecurityAnalystMessages', () => {
  const plan = {
    summary: 'Grant Finance read-only Stripe invoices',
    steps: [{ id: 's1', capability: 'grantAccess', args: { application_id: 'app-1', resource_id: 'res-1', scopes: ['invoices:read'] } }],
  }

  it('renders the plan steps and arguments for review', () => {
    const messages = buildSecurityAnalystMessages(plan, { facts: null, state: null })
    const content = messages[1].content
    expect(content).toContain('grantAccess')
    expect(content).toContain('invoices:read')
    // The review is framed as advisory and never blocking.
    expect(messages[0].content).toContain('advisory')
    expect(messages[0].content).toContain('over-grant')
  })

  it('includes live state evidence so the review judges against current state', () => {
    const messages = buildSecurityAnalystMessages(plan, {
      facts: null,
      state: null,
      evidence: [{ capability: 'listResources', domain: 'resource', ok: true, count: 1, names: ['Stripe invoices'] }],
    })
    expect(messages[1].content).toContain('Live state (read just now)')
    expect(messages[1].content).toContain('Stripe invoices')
  })
})

describe('runSecurityAnalyst', () => {
  const plan = { summary: 'Grant access', steps: [{ id: 's1', capability: 'grantAccess', args: {} }] }

  it('returns the advisory summary and findings', async () => {
    const { gateway } = gatewayProducing({
      summary: 'The grant is broader than the request implies.',
      findings: [{ severity: 'caution', concern: 'Write scope requested where read would suffice.' }],
    })
    const result = await runSecurityAnalyst(gateway, plan, { facts: null, state: null })
    expect(result).toEqual({
      ok: true,
      value: {
        summary: 'The grant is broader than the request implies.',
        findings: [{ severity: 'caution', concern: 'Write scope requested where read would suffice.' }],
      },
    })
  })

  it('accepts a clean review with no findings', async () => {
    const { gateway } = gatewayProducing({ summary: 'The plan is least-privilege and well-scoped.', findings: [] })
    const result = await runSecurityAnalyst(gateway, plan, { facts: null, state: null })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.findings).toEqual([])
  })

  it('fails closed when the review is off-schema, so no advisory is attached', async () => {
    const { gateway } = gatewayProducing(new Error('schema validation failed'))
    const result = await runSecurityAnalyst(gateway, plan, { facts: null, state: null })
    expect(result.ok).toBe(false)
  })
})

describe('runPlanner', () => {
  it('returns a parsed proposed plan', async () => {
    const plan = {
      summary: 'Connect GitHub',
      steps: [{ id: 's1', capability: 'connectProvider', args: { name: 'GitHub', kind: 'oauth2_authorization_code' } }],
    }
    const { gateway } = gatewayProducing(plan)
    const result = await runPlanner(gateway, 'connect github', { facts: null, state: null })
    expect(result).toEqual({ ok: true, value: plan })
  })

  it('fails closed when the plan does not pass the schema', async () => {
    const { gateway } = gatewayProducing(new Error('schema validation failed'))
    const result = await runPlanner(gateway, 'connect github', { facts: null, state: null })
    expect(result).toMatchObject({ ok: false })
  })

  it('accepts an empty plan as a valid "nothing maps" result', async () => {
    const { gateway } = gatewayProducing({ summary: 'No matching action', steps: [] })
    const result = await runPlanner(gateway, 'order me a pizza', { facts: null, state: null })
    expect(result).toEqual({ ok: true, value: { summary: 'No matching action', steps: [] } })
  })
})

describe('runExplainer', () => {
  it('returns the model answer text', async () => {
    const { gateway } = gatewayReturning('  Your agent was denied because it lacks the scope.  ')
    const result = await runExplainer(gateway, 'why was it denied', { facts: null, state: null })
    expect(result).toEqual({ ok: true, value: { text: 'Your agent was denied because it lacks the scope.', reasoning: undefined } })
  })

  it('surfaces the model reasoning when the gateway exposes it', async () => {
    const complete = vi.fn().mockResolvedValueOnce({
      text: 'It lacks the scope.',
      reasoning: 'The grant only covers read, the request needs write.',
      provider: 'test',
      model: 'm',
    } satisfies CompletionResult)
    const gateway = { status: () => ({ enabled: true, providers: [] }), complete } as unknown as Gateway
    const result = await runExplainer(gateway, 'why was it denied', { facts: null, state: null })
    expect(result).toEqual({
      ok: true,
      value: { text: 'It lacks the scope.', reasoning: 'The grant only covers read, the request needs write.' },
    })
  })

  it('fails closed on an empty answer', async () => {
    const { gateway } = gatewayReturning('   ')
    const result = await runExplainer(gateway, 'why', { facts: null, state: null })
    expect(result).toMatchObject({ ok: false })
  })
})
