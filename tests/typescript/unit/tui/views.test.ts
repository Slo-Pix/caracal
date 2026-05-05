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
