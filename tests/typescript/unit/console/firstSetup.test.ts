// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// First setup wizard tests for guided onboarding and generated runtime output.

import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { firstSetupView } from '../../../../apps/console/src/views/setup.ts'
import { DetailView } from '../../../../apps/console/src/views/detail.ts'
import { FormView } from '../../../../apps/console/src/views/form.ts'
import type { App, View, ViewContext } from '../../../../apps/console/src/screen.ts'

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

function makeClient() {
  const zone = { id: 'zone-1', slug: 'zone-slug', name: 'zone-name' }
  const application = {
    id: 'app-1',
    zone_id: 'zone-1',
    name: 'agent-app-name',
    registration_method: 'managed',
    credential_type: 'token',
    traits: [],
    consent: 'false',
    created_at: '2026-01-01T00:00:00.000Z',
  }
  const resource = {
    id: 'res-1',
    zone_id: 'zone-1',
    name: 'resource-name',
    identifier: 'resource://resource-name',
    upstream_url: 'https://upstream-url',
    gateway_application_id: 'app-1',
    prefix: true,
    scopes: ['scope-name'],
    credential_provider_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
  return {
    zones: {
      list: vi.fn(async () => [zone]),
      get: vi.fn(async () => zone),
      create: vi.fn(async () => zone),
    },
    applications: {
      list: vi.fn(async () => [application]),
      get: vi.fn(async () => application),
      create: vi.fn(async () => application),
    },
    resources: {
      list: vi.fn(async () => [resource]),
      get: vi.fn(async () => resource),
      create: vi.fn(async () => resource),
      patch: vi.fn(async (_zoneId: string, _id: string, patch: Partial<typeof resource>) => ({ ...resource, ...patch })),
    },
    policies: {
      create: vi.fn(async () => ({
        id: 'pol-1',
        zone_id: 'zone-1',
        name: 'Guided setup access policy',
        description: '',
        owner_type: 'system',
        created_by: 'console',
        created_at: '2026-01-01T00:00:00.000Z',
        version: {
          id: 'pv-1',
          policy_id: 'pol-1',
          version: 1,
          content_sha256: 'sha',
          schema_version: 'v1',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      })),
    },
    policySets: {
      create: vi.fn(async () => ({ id: 'ps-1', zone_id: 'zone-1', name: 'Guided setup access policy set', created_at: '2026-01-01T00:00:00.000Z' })),
      addVersion: vi.fn(async () => ({ id: 'psv-1', policy_set_id: 'ps-1', version: 1, manifest: [], created_at: '2026-01-01T00:00:00.000Z' })),
      activate: vi.fn(async () => ({ active_version_id: 'psv-1' })),
    },
  }
}

const tempDirs: string[] = []

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'caracal-first-setup-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

function ctx(app: App): ViewContext {
  return { app, size: { rows: 80, cols: 140 }, status: '' }
}

async function answer(view: View, app: App, value?: string): Promise<void> {
  if (value) await view.onKey(value, ctx(app))
  await view.onKey('enter', ctx(app))
}

async function completeMainPath(view: View, app: App): Promise<void> {
  await answer(view, app, 'zone-name')
  await answer(view, app, 'agent-app-name')
  await answer(view, app, 'resource-name')
  await answer(view, app, 'scope-name')
  await answer(view, app)
  await answer(view, app, 'https://upstream-url')
  await answer(view, app, '/request-path')
  await answer(view, app)
  await view.onKey('enter', ctx(app))
}

describe('first setup workflow', () => {
  it('shows one guided prompt at a time and keeps advanced fields out of the main path', async () => {
    const app = fakeApp()
    const view = firstSetupView({
      client: makeClient() as never,
      zoneId: 'zone-1',
    })
    await view.init?.(app)

    const body = view.render(ctx(app)).join('\n')
    expect(body).toContain('Step 1')
    expect(body).toContain('Choose or create a zone')
    expect(body).toContain('A zone groups')
    expect(body).not.toContain('Create or select an agent app')
    expect(body).not.toContain('resource identifier')
    expect(body).not.toContain('provider ID')
    expect(body).not.toContain('profile path')

    await view.onKey('A', ctx(app))
    const advanced = (app as unknown as { _pushed: unknown[] })._pushed.at(-1) as FormView
    expect(advanced).toBeInstanceOf(FormView)
    const advancedBody = advanced.render(ctx(app)).join('\n')
    expect(advancedBody).toContain('resource identifier')
    expect(advancedBody).toContain('profile path')
    expect(advancedBody).not.toContain('provider')

    ;(view as unknown as { values: Record<string, string> }).values.upstream_url = 'https://upstream-url'
    await view.onKey('A', ctx(app))
    const gatewayAdvanced = (app as unknown as { _pushed: unknown[] })._pushed.at(-1) as FormView
    expect(gatewayAdvanced.render(ctx(app)).join('\n')).toContain('provider')
  })

  it('creates the first zone, app, resource, policy, and generated profile from sequential answers', async () => {
    const client = makeClient()
    const selected: string[] = []
    const app = fakeApp()
    const view = firstSetupView({
      client: client as never,
      zoneId: undefined,
      onZoneSelect: (id) => { selected.push(id) },
    } as never)

    await completeMainPath(view, app)

    expect(client.zones.create).toHaveBeenCalledWith({ name: 'zone-name' })
    expect(selected).toEqual(['zone-1'])
    expect(client.applications.create).toHaveBeenCalledWith('zone-1', expect.objectContaining({
      name: 'agent-app-name',
      registration_method: 'managed',
      credential_type: 'token',
      client_secret: expect.stringMatching(/^cs_[A-Za-z0-9_-]+$/),
    }))
    expect(client.resources.create).toHaveBeenCalledWith('zone-1', expect.objectContaining({
      identifier: 'resource://resource-name',
      name: 'resource-name',
      upstream_url: 'https://upstream-url',
      gateway_application_id: 'app-1',
      scopes: ['scope-name'],
    }))
    expect(client.policies.create).toHaveBeenCalledWith('zone-1', expect.objectContaining({
      name: 'Guided setup access policy',
      content: expect.stringContaining('input.principal.id == "app-1"'),
    }))
    expect(client.policySets.activate).toHaveBeenCalledWith('zone-1', 'ps-1', 'psv-1')

    const pushed = (app as unknown as { _pushed: unknown[] })._pushed
    const detail = pushed[pushed.length - 1] as DetailView
    expect(detail).toBeInstanceOf(DetailView)
    await detail.init(app)
    const body = detail.render(ctx(app)).join('\n')
    expect(body).toContain('created')
    expect(body).toContain('CARACAL_RESOURCE_RESOURCE_NAME_TOKEN')
    expect(body).toContain('caracal run --')
    expect(body).toContain("curl -fsS 'http://localhost:8081/request-path'")
    expect(body).toContain("X-Caracal-Resource: resource://resource-name")
    expect(body).toContain('Audit Explanation')
    expect(body).toContain('real Rego allow-list policy')
    expect(body).toContain('deny by default')
    expect(body).toContain('••••')
    expect(body).not.toContain('cs_')
  })

  it('selects existing objects without asking for their IDs in the main flow', async () => {
    const client = makeClient()
    const app = fakeApp()
    const view = firstSetupView({
      client: client as never,
      zoneId: 'zone-1',
    })
    await view.init?.(app)

    await answer(view, app)
    await view.onKey('right', ctx(app))
    let picker = (app as unknown as { _pushed: unknown[] })._pushed.at(-1) as View
    await picker.init?.(app)
    await picker.onKey('enter', ctx(app))
    await answer(view, app)
    await answer(view, app)
    await view.onKey('right', ctx(app))
    picker = (app as unknown as { _pushed: unknown[] })._pushed.at(-1) as View
    await picker.init?.(app)
    await picker.onKey('enter', ctx(app))
    await answer(view, app)
    await answer(view, app)
    await answer(view, app)
    await answer(view, app)
    await answer(view, app)
    await answer(view, app)
    await view.onKey('enter', ctx(app))

    expect(client.zones.create).not.toHaveBeenCalled()
    expect(client.applications.create).not.toHaveBeenCalled()
    expect(client.resources.create).not.toHaveBeenCalled()
    expect(client.resources.patch).not.toHaveBeenCalled()

    const pushed = (app as unknown as { _pushed: unknown[] })._pushed
    const detail = pushed[pushed.length - 1] as DetailView
    await detail.init(app)
    const body = detail.render(ctx(app)).join('\n')
    expect(body).toContain('selected')
    expect(body).toContain('Existing app selected')
    expect(body).not.toContain('Client Secret          ••••')
  })

  it('lets optional policy, profile, and Gateway setup be skipped from advanced settings', async () => {
    const client = makeClient()
    const app = fakeApp()
    const view = firstSetupView({
      client: client as never,
      zoneId: 'zone-1',
    })
    await view.init?.(app)
    Object.assign((view as unknown as { values: Record<string, string> }).values, {
      activate_policy: 'false',
      generate_profile: 'false',
    })

    await answer(view, app)
    await answer(view, app, 'agent-app-name')
    await answer(view, app, 'resource-name')
    await answer(view, app, 'scope-name')
    await answer(view, app)
    await answer(view, app)
    await view.onKey('enter', ctx(app))

    expect(client.zones.create).not.toHaveBeenCalled()
    expect(client.resources.create).toHaveBeenCalledWith('zone-1', expect.objectContaining({
      identifier: 'resource://resource-name',
      upstream_url: undefined,
      gateway_application_id: undefined,
      scopes: ['scope-name'],
    }))
    expect(client.policies.create).not.toHaveBeenCalled()
    expect(client.policySets.create).not.toHaveBeenCalled()
  })

  it('writes generated profile and secret files only when requested', async () => {
    const client = makeClient()
    const app = fakeApp()
    const dir = await tempDir()
    const profilePath = join(dir, 'setup-profile.toml')
    const secretPath = join(dir, 'setup-secret')
    const view = firstSetupView({
      client: client as never,
      zoneId: 'zone-1',
    })
    await view.init?.(app)
    Object.assign((view as unknown as { values: Record<string, string> }).values, {
      profile_path: profilePath,
      secret_file_path: secretPath,
    })

    await answer(view, app)
    await answer(view, app, 'agent-app-name')
    await answer(view, app, 'resource-name')
    await answer(view, app, 'scope-name')
    await answer(view, app)
    await answer(view, app, 'https://upstream-url')
    await answer(view, app, '/request-path')
    await view.onKey('space', ctx(app))
    await answer(view, app)
    await view.onKey('enter', ctx(app))

    const profile = await readFile(profilePath, 'utf8')
    const secret = await readFile(secretPath, 'utf8')
    expect(profile).toContain('application_id = "app-1"')
    expect(profile).toContain(`app_client_secret_file = ${JSON.stringify(secretPath)}`)
    expect(secret).toMatch(/^cs_[A-Za-z0-9_-]+\n$/)
    expect((await stat(profilePath)).mode & 0o777).toBe(0o600)
    expect((await stat(secretPath)).mode & 0o777).toBe(0o600)

    const pushed = (app as unknown as { _pushed: unknown[] })._pushed
    const detail = pushed[pushed.length - 1] as DetailView
    await detail.init(app)
    const body = detail.render(ctx(app)).join('\n')
    expect(body).toContain('File Write')
    expect(body).toContain('written')
    expect(body).toContain('Console wrote the one-time client secret')
    expect(body).not.toContain(secret.trim())
  })

  it('refuses to overwrite existing setup files before creating resources', async () => {
    const client = makeClient()
    const app = fakeApp()
    const dir = await tempDir()
    const profilePath = join(dir, 'setup-profile.toml')
    await writeFile(profilePath, 'existing')
    const view = firstSetupView({
      client: client as never,
      zoneId: 'zone-1',
    })
    await view.init?.(app)
    Object.assign((view as unknown as { values: Record<string, string> }).values, {
      profile_path: profilePath,
      secret_file_path: join(dir, 'setup-secret'),
    })

    await answer(view, app)
    await answer(view, app, 'agent-app-name')
    await answer(view, app, 'resource-name')
    await answer(view, app, 'scope-name')
    await answer(view, app)
    await answer(view, app, 'https://upstream-url')
    await answer(view, app, '/request-path')
    await view.onKey('space', ctx(app))
    await answer(view, app)
    await view.onKey('enter', ctx(app))

    expect(app.setStatus).toHaveBeenCalledWith(expect.stringContaining('refusing to overwrite existing setup file'), 'error')
    expect(client.applications.create).not.toHaveBeenCalled()
    expect(client.resources.create).not.toHaveBeenCalled()
  })
})
