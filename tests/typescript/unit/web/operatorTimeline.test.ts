// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the Operator timeline presenter: item mapping and plan-state resolution.

import { describe, it, expect } from 'vitest'
import { buildTimeline } from '../../../../apps/web/src/platform/operator/timeline'
import type { OperatorTurn } from '../../../../apps/web/src/platform/api/types'

function turn(partial: Partial<OperatorTurn> & Pick<OperatorTurn, 'seq' | 'kind'>): OperatorTurn {
  return {
    id: `turn-${partial.seq}`,
    conversation_id: 'conv-1',
    role: 'user',
    content: {},
    actor_id: 'actor-1',
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

function planTurn(seq: number, steps: { id: string; capability: string; summary: string; mutating: boolean }[]) {
  return turn({ seq, kind: 'plan', role: 'operator', content: { summary: 'Stand up', steps } })
}

describe('buildTimeline', () => {
  it('maps message, note, and error turns into display items', () => {
    const { items } = buildTimeline([
      turn({ seq: 1, kind: 'message', role: 'user', content: { text: 'connect github' } }),
      turn({ seq: 2, kind: 'note', role: 'operator', content: { text: 'here is why' } }),
      turn({ seq: 3, kind: 'error', role: 'system', content: { message: 'failed' } }),
    ])
    expect(items).toHaveLength(3)
    expect(items[0]).toMatchObject({ kind: 'message', role: 'user', text: 'connect github' })
    expect(items[1]).toMatchObject({ kind: 'note', text: 'here is why' })
    expect(items[2]).toMatchObject({ kind: 'error', message: 'failed' })
  })

  it('orders items by sequence regardless of input order', () => {
    const { items } = buildTimeline([
      turn({ seq: 3, kind: 'message', content: { text: 'c' } }),
      turn({ seq: 1, kind: 'message', content: { text: 'a' } }),
      turn({ seq: 2, kind: 'message', content: { text: 'b' } }),
    ])
    expect(items.map((i) => (i.kind === 'message' ? i.text : ''))).toEqual(['a', 'b', 'c'])
  })

  it('marks a pending plan as decidable and not executable', () => {
    const { latestPlan } = buildTimeline([planTurn(1, [{ id: 's1', capability: 'createZone', summary: 'Create a zone', mutating: true }])])
    expect(latestPlan).toMatchObject({ decision: 'pending', canDecide: true, canExecute: false, executed: false })
    expect(latestPlan?.steps[0]).toMatchObject({ capability: 'createZone', status: 'pending' })
  })

  it('marks an approved, unexecuted plan as executable', () => {
    const { latestPlan } = buildTimeline([
      planTurn(1, [{ id: 's1', capability: 'createZone', summary: 'Create a zone', mutating: true }]),
      turn({ seq: 2, kind: 'approval', content: { plan_seq: 1 } }),
    ])
    expect(latestPlan).toMatchObject({ decision: 'approved', canDecide: false, canExecute: true })
  })

  it('reflects rejection with its reason and disables actions', () => {
    const { latestPlan } = buildTimeline([
      planTurn(1, [{ id: 's1', capability: 'createZone', summary: 'Create a zone', mutating: true }]),
      turn({ seq: 2, kind: 'rejection', content: { plan_seq: 1, reason: 'too broad' } }),
    ])
    expect(latestPlan).toMatchObject({ decision: 'rejected', rejectionReason: 'too broad', canDecide: false, canExecute: false })
  })

  it('folds execution turns into per-step status and marks the plan executed', () => {
    const { latestPlan } = buildTimeline([
      planTurn(1, [
        { id: 's1', capability: 'createZone', summary: 'Create a zone', mutating: true },
        { id: 's2', capability: 'registerApplication', summary: 'Register an app', mutating: true },
      ]),
      turn({ seq: 2, kind: 'approval', content: { plan_seq: 1 } }),
      turn({ seq: 3, kind: 'execution', role: 'operator', content: { plan_seq: 1, step_id: 's1', status: 'succeeded', detail: 'done' } }),
      turn({ seq: 4, kind: 'execution', role: 'operator', content: { plan_seq: 1, step_id: 's2', status: 'failed', detail: 'boom' } }),
    ])
    expect(latestPlan?.executed).toBe(true)
    expect(latestPlan?.canExecute).toBe(false)
    expect(latestPlan?.steps.find((s) => s.id === 's1')).toMatchObject({ status: 'succeeded', detail: 'done' })
    expect(latestPlan?.steps.find((s) => s.id === 's2')).toMatchObject({ status: 'failed', detail: 'boom' })
  })

  it('only treats the most recent plan as the actionable latest plan', () => {
    const { items, latestPlan } = buildTimeline([
      planTurn(1, [{ id: 's1', capability: 'createZone', summary: 'Create', mutating: true }]),
      turn({ seq: 2, kind: 'approval', content: { plan_seq: 1 } }),
      planTurn(3, [{ id: 's1', capability: 'registerApplication', summary: 'Register', mutating: true }]),
    ])
    expect(latestPlan?.seq).toBe(3)
    expect(latestPlan?.decision).toBe('pending')
    // The earlier plan is still rendered, resolved as approved, but is not the latest.
    const firstPlan = items.find((i) => i.kind === 'plan' && i.seq === 1)
    expect(firstPlan).toMatchObject({ decision: 'approved' })
  })

  it('returns no latest plan for a conversation without plans', () => {
    const { latestPlan } = buildTimeline([turn({ seq: 1, kind: 'message', content: { text: 'hi' } })])
    expect(latestPlan).toBeNull()
  })

  it('surfaces a persisted advisory security review on the plan', () => {
    const advisory = {
      summary: 'The grant is scoped to read; low blast-radius.',
      findings: [
        { severity: 'caution', concern: 'Confirm the resource selector is not wider than intended.' },
        { severity: 'info', concern: 'No write scopes are requested.' },
      ],
    }
    const { latestPlan } = buildTimeline([
      turn({
        seq: 1,
        kind: 'plan',
        role: 'operator',
        content: {
          summary: 'Grant Finance read-only Stripe',
          steps: [{ id: 's1', capability: 'grantAccess', summary: 'Grant', mutating: true }],
          advisory,
        },
      }),
    ])
    expect(latestPlan?.advisory?.summary).toBe(advisory.summary)
    expect(latestPlan?.advisory?.findings).toEqual(advisory.findings)
  })

  it('drops malformed advisory findings and omits an advisory with no summary', () => {
    const { items } = buildTimeline([
      turn({
        seq: 1,
        kind: 'plan',
        role: 'operator',
        content: {
          summary: 'Plan A',
          steps: [{ id: 's1', capability: 'createZone', summary: 'Create', mutating: true }],
          advisory: {
            summary: 'Reviewed.',
            findings: [
              { severity: 'bogus', concern: 'x' },
              { severity: 'warning', concern: '' },
              { severity: 'warning', concern: 'Real concern.' },
            ],
          },
        },
      }),
      turn({
        seq: 2,
        kind: 'plan',
        role: 'operator',
        content: {
          summary: 'Plan B',
          steps: [{ id: 's1', capability: 'createZone', summary: 'Create', mutating: true }],
          advisory: { summary: '', findings: [] },
        },
      }),
    ])
    const planA = items.find((i) => i.kind === 'plan' && i.seq === 1)
    const planB = items.find((i) => i.kind === 'plan' && i.seq === 2)
    // Only the well-formed finding survives; the unknown severity and the empty concern are dropped.
    expect(planA && planA.kind === 'plan' ? planA.advisory?.findings : null).toEqual([{ severity: 'warning', concern: 'Real concern.' }])
    // An advisory with no summary is treated as absent.
    expect(planB && planB.kind === 'plan' ? planB.advisory : 'missing').toBeUndefined()
  })
})
