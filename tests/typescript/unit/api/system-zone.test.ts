// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the idempotent caracal.sys system zone provisioner and the Operator's least-privilege identity.

import { describe, it, expect } from 'vitest'
import type { AdminClient } from '@caracalai/admin'
import {
  provisionSystemZone,
  operatorControlScopes,
  operatorIdentityTraits,
  SYSTEM_ZONE_SLUG,
  SYSTEM_ZONE_NAME,
  OPERATOR_APP_NAME,
} from '../../../../apps/api/src/system-zone.js'

interface FakeState {
  zones: { id: string; name: string; slug: string }[]
  resources: { id: string; identifier: string; scopes: string[] }[]
  apps: { id: string; name: string; traits?: string[]; client_secret?: string }[]
  calls: string[]
}

// A minimal in-memory AdminClient double covering exactly the surface the provisioner uses.
// It records the calls it receives so a test can assert idempotent, least-privilege
// behavior without a live control plane.
function fakeAdmin(seed: Partial<FakeState> = {}): { admin: AdminClient; state: FakeState } {
  const state: FakeState = { zones: [], resources: [], apps: [], calls: [], ...seed }
  let counter = 0
  const id = (prefix: string): string => `${prefix}-${++counter}`
  const admin = {
    zones: {
      list: async () => {
        state.calls.push('zones.list')
        return state.zones
      },
      create: async (input: { name: string; slug?: string }) => {
        state.calls.push('zones.create')
        const zone = { id: id('zone'), name: input.name, slug: input.slug ?? input.name }
        state.zones.push(zone)
        return zone
      },
    },
    resources: {
      list: async () => {
        state.calls.push('resources.list')
        return state.resources
      },
      create: async (_zone: string, input: { identifier: string; scopes: string[] }) => {
        state.calls.push('resources.create')
        const resource = { id: id('res'), identifier: input.identifier, scopes: input.scopes }
        state.resources.push(resource)
        return resource
      },
      patch: async (_zone: string, rid: string, input: { scopes?: string[] }) => {
        state.calls.push('resources.patch')
        const resource = state.resources.find((r) => r.id === rid)!
        if (input.scopes) resource.scopes = input.scopes
        return resource
      },
    },
    applications: {
      list: async () => {
        state.calls.push('applications.list')
        return state.apps
      },
      create: async (_zone: string, input: { name: string; traits?: string[] }) => {
        state.calls.push('applications.create')
        const app = { id: id('app'), name: input.name, traits: input.traits, client_secret: 'cs_minted_once' }
        state.apps.push(app)
        return app
      },
      patch: async (_zone: string, aid: string, input: { traits?: string[]; client_secret?: string }) => {
        state.calls.push(`applications.patch:${input.client_secret ? 'secret' : 'traits'}`)
        const app = state.apps.find((a) => a.id === aid)!
        if (input.traits) app.traits = input.traits
        if (input.client_secret) app.client_secret = input.client_secret
        return app
      },
    },
  } as unknown as AdminClient
  return { admin, state }
}

describe('operatorControlScopes', () => {
  it('is exactly the union of the governed-executable capability scopes, least privilege', () => {
    expect(operatorControlScopes()).toEqual([
      'control:app:read',
      'control:app:write',
      'control:grant:write',
      'control:identity-provider:read',
    ])
  })
})

describe('operatorIdentityTraits', () => {
  it('grants control:invoke plus one scope trait per least-privilege scope', () => {
    const traits = operatorIdentityTraits()
    expect(traits).toContain('control:invoke')
    for (const scope of operatorControlScopes()) {
      expect(traits).toContain(`control:scope:${scope}`)
    }
    // No traits beyond invoke + the scope set: the identity is exactly least privilege.
    expect(traits.length).toBe(1 + operatorControlScopes().length)
  })
})

describe('provisionSystemZone', () => {
  it('creates the reserved zone, control resource, and least-privilege identity from scratch', async () => {
    const { admin, state } = fakeAdmin()
    const result = await provisionSystemZone(admin, 'cs_sealed_secret')

    const zone = state.zones[0]
    expect(zone).toMatchObject({ name: SYSTEM_ZONE_NAME, slug: SYSTEM_ZONE_SLUG })
    expect(result.zoneId).toBe(zone.id)

    // The control resource was created in the system zone.
    expect(state.resources).toHaveLength(1)

    // The operator identity was created with exactly the least-privilege traits, and its
    // secret was set to the sealed configured value rather than the one-time minted secret.
    const app = state.apps.find((a) => a.name === OPERATOR_APP_NAME)!
    expect(app.id).toBe(result.operatorApplicationId)
    expect([...(app.traits ?? [])].sort()).toEqual(operatorIdentityTraits())
    expect(app.client_secret).toBe('cs_sealed_secret')
    expect(state.calls).toContain('applications.create')
    expect(state.calls).toContain('applications.patch:secret')
  })

  it('is idempotent: reuses the existing zone and reconciles the identity without duplicating', async () => {
    const seeded = fakeAdmin({
      zones: [{ id: 'zone-sys', name: SYSTEM_ZONE_NAME, slug: SYSTEM_ZONE_SLUG }],
      resources: [{ id: 'res-control', identifier: 'caracal-control', scopes: [] }],
      apps: [{ id: 'app-op', name: OPERATOR_APP_NAME, traits: operatorIdentityTraits(), client_secret: 'old' }],
    })
    const result = await provisionSystemZone(seeded.admin, 'cs_rotated')

    // No new zone or application was created.
    expect(result.zoneId).toBe('zone-sys')
    expect(result.operatorApplicationId).toBe('app-op')
    expect(seeded.state.zones).toHaveLength(1)
    expect(seeded.state.apps).toHaveLength(1)
    expect(seeded.state.calls).not.toContain('zones.create')
    expect(seeded.state.calls).not.toContain('applications.create')
    // Traits already match, so they are not re-patched; the secret is reconciled to config.
    expect(seeded.state.calls).not.toContain('applications.patch:traits')
    expect(seeded.state.apps[0].client_secret).toBe('cs_rotated')
  })

  it('self-heals a tampered identity back to least-privilege traits', async () => {
    const seeded = fakeAdmin({
      zones: [{ id: 'zone-sys', name: SYSTEM_ZONE_NAME, slug: SYSTEM_ZONE_SLUG }],
      // A widened identity: an extra scope trait that is not least privilege.
      apps: [{ id: 'app-op', name: OPERATOR_APP_NAME, traits: ['control:invoke', 'control:scope:control:zone:write'], client_secret: 'x' }],
    })
    await provisionSystemZone(seeded.admin, 'cs_sealed')
    expect(seeded.state.calls).toContain('applications.patch:traits')
    expect([...(seeded.state.apps[0].traits ?? [])].sort()).toEqual(operatorIdentityTraits())
  })
})
