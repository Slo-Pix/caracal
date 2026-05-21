// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control credential helpers provision the OAuth resource required for invocation tokens.

import { describe, expect, it, vi } from 'vitest'

import { controlKeyCreate, ensureControlResource } from '../../../../packages/engine/src/control.ts'
import type { AdminClient, Resource } from '../../../../packages/admin/ts/src/index.ts'

function client(resources: Resource[] = []): AdminClient {
  return {
    resources: {
      list: vi.fn(async () => resources),
      create: vi.fn(async (_zoneId: string, input: Partial<Resource>) => ({
        id: 'res-1',
        zone_id: 'z1',
        name: input.name,
        identifier: input.identifier,
        upstream_url: null,
        gateway_application_id: null,
        prefix: false,
        scopes: input.scopes,
        credential_provider_id: null,
        created_at: 'now',
        updated_at: 'now',
      })),
      patch: vi.fn(async (_zoneId: string, id: string, input: Partial<Resource>) => ({
        ...resources.find((resource) => resource.id === id)!,
        ...input,
      })),
    },
    applications: {
      create: vi.fn(async (_zoneId: string, input: object) => ({
        id: 'app-1',
        zone_id: 'z1',
        created_at: 'now',
        ...input,
      })),
    },
  } as unknown as AdminClient
}

describe('control credentials', () => {
  it('creates the control resource before creating a control key', async () => {
    const c = client()

    const result = await controlKeyCreate(c, 'z1', { name: 'robot' })

    expect(c.resources.create).toHaveBeenCalledWith('z1', expect.objectContaining({
      identifier: 'caracal-control',
      scopes: expect.arrayContaining(['control:zone:read', 'control:zone:write', 'control:zone:delete']),
    }))
    expect(c.applications.create).toHaveBeenCalledWith('z1', expect.objectContaining({
      name: 'robot',
      client_secret: expect.stringMatching(/^cs_[A-Za-z0-9_-]+$/),
      traits: ['control:invoke'],
    }))
    expect(result.resource.identifier).toBe('caracal-control')
    expect(result.clientSecret).toMatch(/^cs_[A-Za-z0-9_-]+$/)
  })

  it('patches an existing control resource with missing scopes', async () => {
    const existing = {
      id: 'res-1',
      zone_id: 'z1',
      name: 'Control API',
      identifier: 'caracal-control',
      upstream_url: null,
      gateway_application_id: null,
      prefix: false,
      scopes: ['control:zone:read'],
      credential_provider_id: null,
      created_at: 'now',
      updated_at: 'now',
    } as Resource
    const c = client([existing])

    await ensureControlResource(c, 'z1')

    expect(c.resources.patch).toHaveBeenCalledWith('z1', 'res-1', expect.objectContaining({
      scopes: expect.arrayContaining(['control:zone:write', 'control:zone:delete']),
    }))
  })
})
