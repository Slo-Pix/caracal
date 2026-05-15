// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Per-resource ListView mutation actions wire the right form/confirm and call the engine.

import { describe, it, expect, vi } from 'vitest'
import {
  agentsView,
  applicationsView,
  grantsView,
  policiesView,
  policySetsView,
  providersView,
  resourcesView,
  zonesView,
} from '../../../../apps/tui/src/views/factory.ts'
import { ConfirmView, FormView } from '../../../../apps/tui/src/views/form.ts'
import { ListView } from '../../../../apps/tui/src/views/list.ts'
import type { App } from '../../../../apps/tui/src/screen.ts'

vi.mock('../../../../packages/engine/dist/index.js', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../../../packages/engine/dist/index.js')
  return {
    ...actual,
    zoneCreate: vi.fn(async () => ({})),
    zonePatch: vi.fn(async () => ({})),
    zoneDelete: vi.fn(async () => undefined),
    appCreate: vi.fn(async () => ({})),
    appPatch: vi.fn(async () => ({})),
    appDelete: vi.fn(async () => undefined),
    appDcr: vi.fn(async () => ({})),
    resourceCreate: vi.fn(async () => ({})),
    resourcePatch: vi.fn(async () => ({})),
    resourceDelete: vi.fn(async () => undefined),
    providerCreate: vi.fn(async () => ({})),
    providerPatch: vi.fn(async () => ({})),
    providerDelete: vi.fn(async () => undefined),
    policyCreate: vi.fn(async () => ({})),
    policyVersion: vi.fn(async () => ({})),
    policyDelete: vi.fn(async () => undefined),
    policySetCreate: vi.fn(async () => ({})),
    policySetVersion: vi.fn(async () => ({})),
    policySetActivate: vi.fn(async () => ({})),
    policySetDelete: vi.fn(async () => undefined),
    grantCreate: vi.fn(async () => ({})),
    grantRevoke: vi.fn(async () => undefined),
    delegationRevoke: vi.fn(async () => ({ revoked_edges: 0, affected_sessions: 0 })),
    agentSuspend: vi.fn(async () => ({ suspended: true })),
    agentResume: vi.fn(async () => ({ resumed: true })),
    agentTerminate: vi.fn(async () => undefined),
    agentTree: vi.fn(async () => []),
  }
})

import * as core from '../../../../packages/engine/dist/index.js'

function fakeApp(): App {
  const pushed: unknown[] = []
  const app = {
    invalidate: vi.fn(),
    push: vi.fn((v: unknown) => { pushed.push(v) }),
    pop: vi.fn(),
    setStatus: vi.fn(),
    current: vi.fn(),
    exit: vi.fn(async () => {}),
    replaceTop: vi.fn(),
    bannerLeft: '',
    bannerRight: '',
  } as unknown as App
  ;(app as unknown as { _pushed: unknown[] })._pushed = pushed
  return app
}

const fakeClient = {
  zones: { list: async () => [] },
  applications: { list: async () => [] },
  resources: { list: async () => [] },
  providers: { list: async () => [] },
  policies: { list: async () => [] },
  policySets: { list: async () => [] },
  grants: { list: async () => [] },
  sessions: { list: async () => [] },
  agents: { list: async () => [] },
  audit: { list: async () => [] },
} as unknown as Parameters<typeof zonesView>[0]['client']

const ctx = { client: fakeClient, zoneId: 'z1' }

async function pressKey(view: ListView<unknown>, key: string, app: App): Promise<unknown> {
  await view.onKey(key, { app, size: { rows: 20, cols: 80 }, status: '' })
  const pushed = (app as unknown as { _pushed: unknown[] })._pushed
  return pushed[pushed.length - 1]
}

function setRows(view: ListView<unknown>, rows: unknown[]): void {
  ;(view as unknown as { rows: unknown[]; loading: boolean }).rows = rows
  ;(view as unknown as { rows: unknown[]; loading: boolean }).loading = false
}

describe('zones actions', () => {
  it('n opens a FormView; submit calls zoneCreate', async () => {
    const list = zonesView(ctx) as ListView<unknown>
    const app = fakeApp()
    const pushed = await pressKey(list, 'n', app) as FormView
    expect(pushed).toBeInstanceOf(FormView)
    ;(pushed as unknown as { values: Record<string, string> }).values = { name: 'z', slug: '', org_id: '', dcr_enabled: 'false', pkce_required: 'true', login_flow: '' }
    await pushed.onKey('enter', { app, size: { rows: 20, cols: 80 }, status: '' })
    ;(pushed as unknown as { focus: number }).focus = 6
    await pushed.onKey('enter', { app, size: { rows: 20, cols: 80 }, status: '' })
    expect(core.zoneCreate).toHaveBeenCalled()
  })

  it('d on row opens ConfirmView; y calls zoneDelete', async () => {
    const list = zonesView(ctx) as ListView<unknown>
    setRows(list, [{ id: 'z1', slug: 'sl', name: 'n', login_flow: 'p', dcr_enabled: false, pkce_required: true }])
    const app = fakeApp()
    const pushed = await pressKey(list, 'd', app) as ConfirmView
    expect(pushed).toBeInstanceOf(ConfirmView)
    await pushed.onKey('y', { app, size: { rows: 20, cols: 80 }, status: '' })
    expect(core.zoneDelete).toHaveBeenCalledWith({ client: fakeClient, id: 'z1' })
  })
})

describe('applications actions', () => {
  it('n opens FormView with method/credential/secret/traits/consent fields', async () => {
    const list = applicationsView(ctx) as ListView<unknown>
    const pushed = await pressKey(list, 'n', fakeApp()) as FormView
    const keys = (pushed as unknown as { fields: { key: string }[] }).fields.map((f) => f.key)
    expect(keys).toEqual(['name', 'registration_method', 'credential_type', 'client_secret', 'traits', 'consent'])
  })

  it('D opens ConfirmView and calls appDcr', async () => {
    const list = applicationsView(ctx) as ListView<unknown>
    setRows(list, [{ id: 'a1', name: 'app', registration_method: 'managed', credential_type: 'token', traits: [] }])
    const app = fakeApp()
    const pushed = await pressKey(list, 'D', app) as ConfirmView
    expect(pushed).toBeInstanceOf(ConfirmView)
    await pushed.onKey('y', { app, size: { rows: 20, cols: 80 }, status: '' })
    expect(core.appDcr).toHaveBeenCalled()
  })
})

describe('resources actions', () => {
  it('n opens FormView with identifier+scopes required', async () => {
    const list = resourcesView(ctx) as ListView<unknown>
    const pushed = await pressKey(list, 'n', fakeApp()) as FormView
    const keys = (pushed as unknown as { fields: { key: string; required?: boolean }[] }).fields
      .filter((f) => f.required).map((f) => f.key)
    expect(keys).toContain('identifier')
    expect(keys).toContain('scopes')
  })
})

describe('providers actions', () => {
  it('n opens FormView with config_json multiline', async () => {
    const list = providersView(ctx) as ListView<unknown>
    const pushed = await pressKey(list, 'n', fakeApp()) as FormView
    const fields = (pushed as unknown as { fields: { key: string; kind: string }[] }).fields
    expect(fields.find((f) => f.key === 'config_json')?.kind).toBe('multiline')
  })
})

describe('policies actions', () => {
  it('v on row opens FormView for policy version', async () => {
    const list = policiesView(ctx) as ListView<unknown>
    setRows(list, [{ id: 'p1', name: 'pol', owner_type: 'admin', description: null }])
    const pushed = await pressKey(list, 'v', fakeApp()) as FormView
    expect(pushed).toBeInstanceOf(FormView)
    const keys = (pushed as unknown as { fields: { key: string }[] }).fields.map((f) => f.key)
    expect(keys).toEqual(['file', 'content', 'schema_version'])
  })
})

describe('policySets actions', () => {
  it('a on row opens FormView for activate', async () => {
    const list = policySetsView(ctx) as ListView<unknown>
    setRows(list, [{ id: 'ps1', name: 'ps', description: null, active_version_id: null }])
    const pushed = await pressKey(list, 'a', fakeApp()) as FormView
    const keys = (pushed as unknown as { fields: { key: string }[] }).fields.map((f) => f.key)
    expect(keys).toEqual(['version_id', 'shadow_version_id'])
  })
})

describe('grants actions', () => {
  it('k revokes selected grant', async () => {
    const list = grantsView(ctx) as ListView<unknown>
    setRows(list, [{ id: 'g1', application_id: 'a', user_id: 'u', resource_id: 'r', scopes: [], status: 'active' }])
    const app = fakeApp()
    const pushed = await pressKey(list, 'k', app) as ConfirmView
    await pushed.onKey('y', { app, size: { rows: 20, cols: 80 }, status: '' })
    expect(core.grantRevoke).toHaveBeenCalledWith({ client: fakeClient, zoneId: 'z1', id: 'g1' })
  })
})

describe('agents actions', () => {
  it('s/r/t open ConfirmView for suspend/resume/terminate', async () => {
    for (const [key, fn] of [['s', core.agentSuspend], ['r', core.agentResume], ['t', core.agentTerminate]] as const) {
      const list = agentsView(ctx) as ListView<unknown>
      setRows(list, [{ id: 'ag1', application_id: 'a', parent_id: null, status: 'active', depth: 0, spawned_at: 'now' }])
      const app = fakeApp()
      const pushed = await pressKey(list, key, app) as ConfirmView
      expect(pushed).toBeInstanceOf(ConfirmView)
      await pushed.onKey('y', { app, size: { rows: 20, cols: 80 }, status: '' })
      expect(fn).toHaveBeenCalledWith({ client: fakeClient, zoneId: 'z1', id: 'ag1' })
    }
  })

  it('T opens DetailView calling agentTree', async () => {
    const list = agentsView(ctx) as ListView<unknown>
    setRows(list, [{ id: 'ag1', application_id: 'a', parent_id: null, status: 'active', depth: 0, spawned_at: 'now' }])
    const pushed = await pressKey(list, 'T', fakeApp()) as { title: string }
    expect(pushed.title).toContain('agent-tree')
  })
})
