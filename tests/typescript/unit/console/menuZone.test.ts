// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Menu zone hotkey tests cover picker launch and selected zone application.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, it, expect, vi } from 'vitest'

import { MenuView } from '../../../../apps/console/src/views/menu.ts'
import { ConsoleStateStore } from '../../../../apps/console/src/state.ts'
import type { App } from '../../../../apps/console/src/screen.ts'
import type { AdminClient, Zone } from '@caracalai/admin'

const dirs: string[] = []
const ansiPattern = /\u001b\[[0-9;?]*[A-Za-z]/g

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function stripAnsi(value: string): string {
  return value.replace(ansiPattern, '')
}

function stateStore(): ConsoleStateStore {
  const dir = mkdtempSync(join(tmpdir(), 'caracal-menu-zone-'))
  dirs.push(dir)
  return new ConsoleStateStore(join(dir, 'console-state.json'))
}

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

function clientWithZones(zones: Zone[]): AdminClient {
  return {
    zones: {
      list: vi.fn(async () => zones),
      get: vi.fn(async () => ({})),
    },
  } as unknown as AdminClient
}

describe('menu zone hotkey', () => {
  it('renders each top-level group as one contiguous section', () => {
    const menu = new MenuView(clientWithZones([]), 'zone-1')
    const lines = menu.render({ app: fakeApp(), size: { rows: 25, cols: 100 }, status: '' }).map(stripAnsi)
    const groups = lines
      .map((line) => line.trim())
      .filter((line) => ['start', 'manage', 'sessions', 'observe', 'runtime'].includes(line))

    expect(groups).toEqual(['start', 'manage', 'sessions', 'observe', 'runtime'])
  })

  it('uses ordered management numbers and semantic group hotkeys', () => {
    const menu = new MenuView(clientWithZones([]), 'zone-1')
    const rendered = menu.render({ app: fakeApp(), size: { rows: 25, cols: 100 }, status: '' }).map(stripAnsi).join('\n')

    expect(rendered).toContain(' s  guided setup')
    for (const [key, label] of [
      ['1', 'zone'],
      ['2', 'application'],
      ['3', 'provider'],
      ['4', 'resource'],
      ['5', 'policy'],
      ['6', 'policy set'],
      ['7', 'grant'],
      ['8', 'authority session'],
    ]) {
      expect(rendered).toContain(` ${key}  ${label}`)
    }
    expect(rendered).toContain(' a  audit')
    expect(rendered).toContain(' t  request trace')
    expect(rendered).toContain(' r  agent session')
    expect(rendered).toContain(' g  delegation')
    expect(rendered).toContain(' c  control')
    expect(rendered).toContain(' d  diagnostics')
    expect(rendered).not.toContain(' c  credential')
  })

  it('aligns long labels before descriptions', () => {
    const menu = new MenuView(clientWithZones([]), 'zone-1')
    const lines = menu.render({ app: fakeApp(), size: { rows: 25, cols: 100 }, status: '' }).map(stripAnsi)

    expect(lines.find((line) => line.includes('authority session'))).toContain('authority session  Inspect active authority sessions')
    expect(lines.find((line) => line.includes('request trace'))).toContain('request trace      Trace one audit request ID')
    expect(lines.find((line) => line.includes('agent session'))).toContain('agent session      Manage agent sessions')
  })

  it('opens operationally useful contextual menu help', async () => {
    const app = fakeApp()
    const menu = new MenuView(clientWithZones([]), 'zone-1')

    await menu.onKey('?', { app, size: { rows: 25, cols: 100 }, status: '' })

    const pushed = (app as unknown as { _pushed: Array<{ render: typeof menu.render }> })._pushed
    const help = pushed[pushed.length - 1]!.render({ app, size: { rows: 25, cols: 100 }, status: '' }).map(stripAnsi).join('\n')
    expect(help).toContain('Impact')
    expect(help).toContain('Context')
    expect(help).toContain('Current zone')
    expect(help).toContain('Operational notes')
  })

  it('opens the zone picker with z and applies the selected zone', async () => {
    const client = clientWithZones([
      { id: 'z1', slug: 'alpha', name: 'Alpha' },
      { id: 'z2', slug: 'beta', name: 'Beta' },
    ] as Zone[])
    const menu = new MenuView(client, undefined)
    const app = fakeApp()

    await menu.onKey('z', { app, size: { rows: 25, cols: 80 }, status: '' })
    const pushed = (app as unknown as { _pushed: unknown[] })._pushed
    const picker = pushed[pushed.length - 1] as { title: string; onKey: MenuView['onKey'] }

    expect(client.zones.list).toHaveBeenCalledOnce()
    expect(picker.title).toBe('select zone')

    await picker.onKey('down', { app, size: { rows: 25, cols: 80 }, status: '' })
    await picker.onKey('enter', { app, size: { rows: 25, cols: 80 }, status: '' })

    expect(menu.currentZoneId()).toBe('z2')
    expect(app.setStatus).toHaveBeenCalledWith('zone set to beta')
    expect(app.pop).toHaveBeenCalledOnce()
  })

  it('persists the explicitly selected zone', async () => {
    const client = clientWithZones([
      { id: 'z1', slug: 'alpha', name: 'Alpha' },
      { id: 'z2', slug: 'beta', name: 'Beta' },
    ] as Zone[])
    const state = stateStore()
    const menu = new MenuView(client, undefined, state)
    const app = fakeApp()

    await menu.onKey('z', { app, size: { rows: 25, cols: 80 }, status: '' })
    const pushed = (app as unknown as { _pushed: unknown[] })._pushed
    const picker = pushed[pushed.length - 1] as { title: string; onKey: MenuView['onKey'] }
    await picker.onKey('down', { app, size: { rows: 25, cols: 80 }, status: '' })
    await picker.onKey('enter', { app, size: { rows: 25, cols: 80 }, status: '' })

    expect(state.selectedZoneId()).toBe('z2')
    expect(state.selectedZoneSlug()).toBe('beta')
  })

  it('opens the zone picker with uppercase Z', async () => {
    const client = clientWithZones([{ id: 'z1', slug: 'alpha', name: 'Alpha' }] as Zone[])
    const menu = new MenuView(client, undefined)
    const app = fakeApp()

    await menu.onKey('Z', { app, size: { rows: 25, cols: 80 }, status: '' })

    expect(client.zones.list).toHaveBeenCalledOnce()
    expect(app.push).toHaveBeenCalledWith(expect.objectContaining({ title: 'select zone' }))
  })

  it('clears a stale configured zone on init', async () => {
    const state = stateStore()
    state.setSelectedZone('z1', 'pied-piper')
    const client = clientWithZones([])
    vi.mocked(client.zones.get).mockRejectedValueOnce({ status: 404 })
    const menu = new MenuView(client, 'z1', state)
    const app = fakeApp()

    await menu.init(app)

    expect(menu.currentZoneId()).toBeUndefined()
    expect(state.selectedZoneId()).toBeUndefined()
    expect(app.setStatus).toHaveBeenCalledWith(expect.stringContaining('configured zone z1 no longer exists'), 'error')
  })

  it('reports zone picker empty and failure states', async () => {
    const empty = new MenuView(clientWithZones([]), undefined)
    const emptyApp = fakeApp()
    await empty.onKey('z', { app: emptyApp, size: { rows: 25, cols: 80 }, status: '' })
    expect(emptyApp.setStatus).toHaveBeenCalledWith('no zones: open Zones (n) to create one', 'error')

    const failingClient = clientWithZones([])
    vi.mocked(failingClient.zones.list).mockRejectedValueOnce(new Error('list failed'))
    const failing = new MenuView(failingClient, undefined)
    const failingApp = fakeApp()
    await failing.onKey('z', { app: failingApp, size: { rows: 25, cols: 80 }, status: '' })
    expect(failingApp.setStatus).toHaveBeenCalledWith('zone list: list failed', 'error')
  })

  it('blocks zone-scoped entries until a zone is selected', async () => {
    const menu = new MenuView(clientWithZones([]), undefined)
    const app = fakeApp()

    await menu.onKey('2', { app, size: { rows: 25, cols: 80 }, status: '' })

    expect(app.push).not.toHaveBeenCalled()
    expect(app.setStatus).toHaveBeenCalledWith('zone required: press z to set one or pick Zones first', 'error')
  })

  it('opens every top-level info page from the current selection', async () => {
    const menu = new MenuView(clientWithZones([]), 'z1')
    const app = fakeApp()
    const ctx = { app, size: { rows: 25, cols: 100 }, status: '' }

    for (const key of ['s', '1', '2', '3', '4', '5', '6', '7', '8', 'r', 'g', 'a', 't', 'c', 'd']) {
      await menu.onKey(key, ctx)
      await menu.onKey('?', ctx)
    }

    const pushed = (app as unknown as { _pushed: Array<{ render?: typeof menu.render }> })._pushed
    const helpText = pushed
      .filter((view) => typeof view.render === 'function')
      .map((view) => view.render!(ctx).map(stripAnsi).join('\n'))
      .join('\n')

    expect(helpText).toContain('Pied Piper zone')
    expect(helpText).toContain('Hooli OAuth')
    expect(helpText).toContain('issue token with zones:read resources:write')
    expect(helpText).toContain('strict readiness before a PiperNet launch smoke run')
  })

  it('renders and navigates the Control submenu without running lifecycle commands', async () => {
    const menu = new MenuView(clientWithZones([]), 'z1')
    const app = fakeApp()
    const ctx = { app, size: { rows: 25, cols: 100 }, status: '' }

    await menu.onKey('c', ctx)
    const pushed = (app as unknown as { _pushed: Array<{ title: string; render: typeof menu.render; onKey: typeof menu.onKey; hints: () => string[] }> })._pushed
    const control = pushed[pushed.length - 1]!

    expect(control.title).toBe('control')
    expect(control.hints()).toContain('enter:open')
    expect(control.render(ctx).map(stripAnsi).join('\n')).toContain('Control API')

    await control.onKey('down', ctx)
    await control.onKey('?', ctx)
    await control.onKey('l', ctx)
    await control.onKey('esc', ctx)

    expect(app.push).toHaveBeenCalledWith(expect.objectContaining({ title: 'control / keys' }))
    expect(app.pop).toHaveBeenCalled()
  })
})
