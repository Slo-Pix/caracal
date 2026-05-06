// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// FormView and ConfirmView unit tests.

import { describe, it, expect, vi } from 'vitest'
import { FormView, ConfirmView } from '../../../../apps/tui/src/views/form.ts'
import type { App } from '../../../../apps/tui/src/screen.ts'

function fakeApp(): App & { _pushed: unknown[]; _popped: number } {
  const pushed: unknown[] = []
  let popped = 0
  const app = {
    invalidate: vi.fn(),
    push: vi.fn((v: unknown) => { pushed.push(v) }),
    pop: vi.fn(() => { popped++ }),
    current: vi.fn(),
    setStatus: vi.fn(),
    exit: vi.fn(async () => {}),
    replaceTop: vi.fn(),
    bannerLeft: '',
    bannerRight: '',
  } as unknown as App & { _pushed: unknown[]; _popped: number }
  Object.defineProperty(app, '_pushed', { get: () => pushed })
  Object.defineProperty(app, '_popped', { get: () => popped })
  return app
}

function ctx(app: App) {
  return { app, size: { rows: 24, cols: 80 }, status: '' }
}

describe('FormView', () => {
  it('renders field labels and placeholder', async () => {
    const view = new FormView('Create', [
      { label: 'Name', key: 'name', required: true, placeholder: 'enter name' },
      { label: 'Desc', key: 'desc', placeholder: 'optional' },
    ], vi.fn())
    const app = fakeApp()
    const lines = view.render(ctx(app))
    const all = lines.join('\n')
    expect(all).toContain('Name')
    expect(all).toContain('Desc')
  })

  it('types characters into the active field', async () => {
    const view = new FormView('Create', [
      { label: 'Name', key: 'name', required: true },
    ], vi.fn())
    const app = fakeApp()
    await view.onKey('h', ctx(app))
    await view.onKey('i', ctx(app))
    const lines = view.render(ctx(app))
    expect(lines.join('\n')).toContain('hi')
  })

  it('backspace removes last character', async () => {
    const view = new FormView('Create', [
      { label: 'Name', key: 'name', required: true },
    ], vi.fn())
    const app = fakeApp()
    await view.onKey('a', ctx(app))
    await view.onKey('b', ctx(app))
    await view.onKey('backspace', ctx(app))
    const lines = view.render(ctx(app))
    expect(lines.join('\n')).toContain('a')
    expect(lines.join('\n')).not.toContain('ab')
  })

  it('Tab advances to next field', async () => {
    const view = new FormView('Create', [
      { label: 'A', key: 'a' },
      { label: 'B', key: 'b' },
    ], vi.fn())
    const app = fakeApp()
    await view.onKey('tab', ctx(app))
    await view.onKey('x', ctx(app))
    const lines = view.render(ctx(app))
    expect(lines.join('\n')).toContain('x')
  })

  it('up moves back to previous field', async () => {
    const view = new FormView('Create', [
      { label: 'A', key: 'a' },
      { label: 'B', key: 'b' },
    ], vi.fn())
    const app = fakeApp()
    await view.onKey('tab', ctx(app))
    await view.onKey('up', ctx(app))
    await view.onKey('z', ctx(app))
    const lines = view.render(ctx(app))
    expect(lines.join('\n')).toContain('z')
  })

  it('Esc cancels and pops the view', async () => {
    const view = new FormView('Create', [{ label: 'x', key: 'x' }], vi.fn())
    const app = fakeApp()
    await view.onKey('esc', ctx(app))
    expect(app.pop).toHaveBeenCalled()
  })

  it('blocks submit when required field is empty', async () => {
    const submit = vi.fn()
    const view = new FormView('Create', [
      { label: 'Name', key: 'name', required: true },
    ], submit)
    const app = fakeApp()
    await view.onKey('ctrl-s', ctx(app))
    expect(submit).not.toHaveBeenCalled()
    expect(app.pop).not.toHaveBeenCalled()
    const lines = view.render(ctx(app))
    expect(lines.join('\n')).toContain('required')
  })

  it('calls onSubmit and pops on success', async () => {
    const submit = vi.fn(async () => {})
    const view = new FormView('Create', [
      { label: 'Name', key: 'name', required: true },
    ], submit)
    const app = fakeApp()
    await view.onKey('h', ctx(app))
    await view.onKey('ctrl-s', ctx(app))
    expect(submit).toHaveBeenCalledWith({ name: 'h' }, app)
    expect(app.pop).toHaveBeenCalled()
  })

  it('shows error and stays open on submit failure', async () => {
    const err = Object.assign(new Error('boom'), { status: 400, code: 'invalid' })
    const submit = vi.fn(async () => { throw err })
    const view = new FormView('Create', [
      { label: 'Name', key: 'name', required: true },
    ], submit)
    const app = fakeApp()
    await view.onKey('x', ctx(app))
    await view.onKey('ctrl-s', ctx(app))
    expect(app.pop).not.toHaveBeenCalled()
    const lines = view.render(ctx(app))
    expect(lines.join('\n').toLowerCase()).toContain('error')
  })

  it('Enter on last field submits', async () => {
    const submit = vi.fn(async () => {})
    const view = new FormView('Create', [
      { label: 'Name', key: 'name', required: true },
    ], submit)
    const app = fakeApp()
    await view.onKey('a', ctx(app))
    await view.onKey('enter', ctx(app))
    expect(submit).toHaveBeenCalledWith({ name: 'a' }, app)
  })

  it('Enter on non-last field advances focus', async () => {
    const submit = vi.fn(async () => {})
    const view = new FormView('Create', [
      { label: 'A', key: 'a', required: true },
      { label: 'B', key: 'b', required: true },
    ], submit)
    const app = fakeApp()
    await view.onKey('a', ctx(app))
    await view.onKey('enter', ctx(app))
    expect(submit).not.toHaveBeenCalled()
    await view.onKey('b', ctx(app))
    await view.onKey('enter', ctx(app))
    expect(submit).toHaveBeenCalledWith({ a: 'a', b: 'b' }, app)
  })

  it('isTextEntry is true', () => {
    const view = new FormView('Create', [], vi.fn())
    expect(view.isTextEntry).toBe(true)
  })
})

describe('ConfirmView', () => {
  it('renders the message', () => {
    const view = new ConfirmView('Delete', 'Are you sure you want to delete foo?', vi.fn())
    const app = fakeApp()
    const lines = view.render(ctx(app))
    expect(lines.join('\n')).toContain('Are you sure you want to delete foo?')
  })

  it('y key runs the action', async () => {
    const action = vi.fn(async () => {})
    const view = new ConfirmView('Delete', 'delete foo?', action)
    const app = fakeApp()
    await view.onKey('y', ctx(app))
    expect(app.pop).toHaveBeenCalled()
    expect(action).toHaveBeenCalledWith(app)
  })

  it('non-y key cancels without running action', async () => {
    const action = vi.fn(async () => {})
    const view = new ConfirmView('Delete', 'delete foo?', action)
    const app = fakeApp()
    await view.onKey('n', ctx(app))
    expect(app.pop).toHaveBeenCalled()
    expect(action).not.toHaveBeenCalled()
  })

  it('esc cancels without running action', async () => {
    const action = vi.fn(async () => {})
    const view = new ConfirmView('Delete', 'delete foo?', action)
    const app = fakeApp()
    await view.onKey('esc', ctx(app))
    expect(app.pop).toHaveBeenCalled()
    expect(action).not.toHaveBeenCalled()
  })
})
