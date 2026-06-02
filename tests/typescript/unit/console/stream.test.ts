// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// StreamView line buffering, ANSI scrubbing, and dispose-handle tests.

import { describe, it, expect, vi } from 'vitest'
import { StreamView } from '../../../../apps/console/src/views/stream.ts'
import type { App } from '../../../../apps/console/src/screen.ts'

function fakeApp(): App {
  return {
    invalidate: vi.fn(),
    push: vi.fn(),
    pop: vi.fn(),
    setStatus: vi.fn(),
    current: vi.fn(),
    exit: vi.fn(async () => {}),
    replaceTop: vi.fn(),
    bannerLeft: '',
    bannerRight: '',
  } as unknown as App
}

describe('StreamView', () => {
  it('buffers lines and renders the tail', async () => {
    let push: ((l: string) => void) | undefined
    const view = new StreamView({
      title: 'x',
      spawn: (onLine) => {
        push = onLine
        return { dispose: vi.fn(), exitCode: new Promise(() => {}) }
      },
    })
    const app = fakeApp()
    await view.init(app)
    push!('line1')
    push!('line2')
    const lines = view.render({ app, size: { rows: 5, cols: 80 }, status: '' }).join('\n')
    expect(lines).toContain('line1')
    expect(lines).toContain('line2')
  })

  it('strips ANSI escapes from incoming lines', async () => {
    let push: ((l: string) => void) | undefined
    const view = new StreamView({
      title: 'x',
      spawn: (onLine) => {
        push = onLine
        return { dispose: vi.fn(), exitCode: new Promise(() => {}) }
      },
    })
    const app = fakeApp()
    await view.init(app)
    push!('hi\u001b[2Joops')
    const buf = (view as unknown as { buf: string[] }).buf.join('\n')
    expect(buf).not.toContain('\u001b')
    expect(buf).toContain('oops')
  })

  it('dispose calls the underlying handle dispose', async () => {
    const dispose = vi.fn()
    const view = new StreamView({
      title: 'x',
      spawn: () => ({ dispose, exitCode: new Promise(() => {}) }),
    })
    await view.init(fakeApp())
    view.dispose()
    expect(dispose).toHaveBeenCalled()
  })

  it('renders spawn errors and exit status changes', async () => {
    const failed = new StreamView({
      title: 'x',
      spawn: () => { throw new Error('spawn failed') },
    })
    const app = fakeApp()
    await failed.init(app)
    expect(failed.render({ app, size: { rows: 3, cols: 80 }, status: '' }).join('\n')).toContain('spawn failed')

    let resolveExit: (code: number) => void = () => {}
    const exited = new StreamView({
      title: 'x',
      spawn: () => ({ dispose: vi.fn(), exitCode: new Promise<number>((resolve) => { resolveExit = resolve }) }),
    })
    await exited.init(app)
    resolveExit(7)
    await Promise.resolve()
    expect(exited.render({ app, size: { rows: 3, cols: 80 }, status: '' }).join('\n')).toContain('exited(7)')
  })

  it('supports scroll, tail, and back keys', async () => {
    let push: ((l: string) => void) | undefined
    const view = new StreamView({
      title: 'x',
      spawn: (onLine) => {
        push = onLine
        return { dispose: vi.fn(), exitCode: new Promise(() => {}) }
      },
    })
    const app = fakeApp()
    await view.init(app)
    for (const line of ['one', 'two', 'three']) push!(line)

    view.onKey('up', { app, size: { rows: 3, cols: 80 }, status: '' })
    view.onKey('pgup', { app, size: { rows: 3, cols: 80 }, status: '' })
    view.onKey('down', { app, size: { rows: 3, cols: 80 }, status: '' })
    view.onKey('pgdn', { app, size: { rows: 3, cols: 80 }, status: '' })
    view.onKey('G', { app, size: { rows: 3, cols: 80 }, status: '' })
    view.onKey('esc', { app, size: { rows: 3, cols: 80 }, status: '' })

    expect(app.pop).toHaveBeenCalled()
    expect(view.render({ app, size: { rows: 3, cols: 80 }, status: '' }).join('\n')).toContain('three')
  })
})
