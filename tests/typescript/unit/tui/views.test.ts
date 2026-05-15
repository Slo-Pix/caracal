// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// ListView and DetailView behavior tests against a fake App.

import { describe, it, expect, vi } from 'vitest'
import { ListView } from '../../../../apps/tui/src/views/list.ts'
import { DetailView } from '../../../../apps/tui/src/views/detail.ts'
import type { App } from '../../../../apps/tui/src/screen.ts'

function fakeApp(): App {
  const pushed: unknown[] = []
  const status: { text: string; kind: string }[] = []
  const app = {
    invalidate: vi.fn(),
    push: vi.fn((v: unknown) => { pushed.push(v) }),
    pop: vi.fn(),
    current: vi.fn(),
    setStatus: vi.fn((t: string, k: 'info' | 'error' = 'info') => { status.push({ text: t, kind: k }) }),
    exit: vi.fn(async () => {}),
    replaceTop: vi.fn(),
    bannerLeft: '',
    bannerRight: '',
  } as unknown as App
  ;(app as unknown as { _pushed: unknown[]; _status: typeof status })._pushed = pushed
  ;(app as unknown as { _pushed: unknown[]; _status: typeof status })._status = status
  return app
}

describe('AuditTailView', () => {
  it('keeps cursor at 0 when receiving navigation with no events', async () => {
    const { AuditTailView } = await import('../../../../apps/tui/src/views/audit.ts')
    const fakeClient = { audit: { tail: vi.fn(), byRequest: vi.fn() } } as unknown as Parameters<typeof AuditTailView>[0]
    const view = new AuditTailView(fakeClient as never, 'zone-1')
    const ctx = { app: fakeApp(), size: { rows: 10, cols: 80 }, status: '' }
    await view.onKey('down', ctx)
    await view.onKey('pgdn', ctx)
    await view.onKey('up', ctx)
    const rendered = view.render(ctx).join('\n')
    expect(rendered).toContain('no events yet')
    const cursor = (view as unknown as { cursor: number }).cursor
    expect(cursor).toBe(0)
  })

  it('sanitizes API-sourced fields so injected escapes cannot reach the terminal', async () => {
    const { AuditTailView } = await import('../../../../apps/tui/src/views/audit.ts')
    const fakeClient = { audit: { tail: vi.fn(), byRequest: vi.fn() } } as unknown as Parameters<typeof AuditTailView>[0]
    const view = new AuditTailView(fakeClient as never, 'zone-1')
    ;(view as unknown as { events: unknown[] }).events = [{
      occurred_at: '2025-01-01T00:00:00Z',
      event_type: 'evil\u001b[2J',
      decision: 'allow',
      evaluation_status: 'ok',
      request_id: 'req-\u001b]0;hijack\u0007',
    }]
    const ctx = { app: fakeApp(), size: { rows: 10, cols: 200 }, status: '' }
    const lines = view.render(ctx).join('\n')
    // Only the SGR escapes that the renderer itself emits (e.g. invert/fg) may
    // appear; injected ESC bytes from event_type / request_id must be gone.
    expect(lines).not.toContain('evil\u001b[2J')
    expect(lines).not.toContain('\u001b]')
    expect(lines).not.toContain('\u0007')
  })
})

describe('ListView', () => {
  it('loads rows and renders header + cursor row', async () => {
    const app = fakeApp()
    const view = new ListView<{ id: string; name: string }>({
      title: 'things',
      columns: [{ header: 'id', width: 4, value: (r) => r.id }, { header: 'name', value: (r) => r.name }],
      load: async () => [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }],
    })
    await view.init(app)
    const lines = view.render({ app, size: { rows: 10, cols: 40 }, status: '' })
    expect(lines[0]).toContain('id')
    expect(lines[0]).toContain('name')
    expect(lines[1]).toContain('a')
    expect(lines[1]).toContain('Alpha')
    expect(lines[2]).toContain('b')
  })

  it('moves cursor with j/k and triggers onEnter on enter', async () => {
    const app = fakeApp()
    const seen: string[] = []
    const view = new ListView<{ id: string }>({
      title: 'x',
      columns: [{ header: 'id', value: (r) => r.id }],
      load: async () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      onEnter: (_app, row) => { seen.push(row.id) },
    })
    await view.init(app)
    await view.onKey('j', { app, size: { rows: 10, cols: 40 }, status: '' })
    await view.onKey('j', { app, size: { rows: 10, cols: 40 }, status: '' })
    await view.onKey('enter', { app, size: { rows: 10, cols: 40 }, status: '' })
    expect(seen).toEqual(['c'])
  })

  it('shows error banner when load throws', async () => {
    const app = fakeApp()
    const view = new ListView<{ id: string }>({
      title: 'x',
      columns: [{ header: 'id', value: (r) => r.id }],
      load: async () => { throw new Error('boom') },
    })
    await view.init(app)
    const lines = view.render({ app, size: { rows: 10, cols: 40 }, status: '' })
    expect(lines[0]).toContain('error: boom')
  })

  it('back key pops the app', async () => {
    const app = fakeApp()
    const view = new ListView<{ id: string }>({
      title: 'x',
      columns: [{ header: 'id', value: (r) => r.id }],
      load: async () => [],
    })
    await view.init(app)
    await view.onKey('h', { app, size: { rows: 10, cols: 40 }, status: '' })
    expect(app.pop).toHaveBeenCalled()
  })
})

describe('DetailView', () => {
  it('renders pretty JSON', async () => {
    const app = fakeApp()
    const view = new DetailView({ title: 'x', load: async () => ({ name: 'demo', count: 3 }) })
    await view.init(app)
    const lines = view.render({ app, size: { rows: 10, cols: 80 }, status: '' })
    const joined = lines.join('\n')
    expect(joined).toContain('"name"')
    expect(joined).toContain('"demo"')
  })

  it('scrolls with j and k', async () => {
    const app = fakeApp()
    const big = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]))
    const view = new DetailView({ title: 'x', load: async () => big })
    await view.init(app)
    await view.onKey('j', { app, size: { rows: 5, cols: 80 }, status: '' })
    await view.onKey('j', { app, size: { rows: 5, cols: 80 }, status: '' })
    const lines = view.render({ app, size: { rows: 5, cols: 80 }, status: '' })
    expect(lines[0]).toContain('"k1"')
  })
})
