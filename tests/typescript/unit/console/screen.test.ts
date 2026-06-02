// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// ANSI helpers and key parser unit tests.

import { describe, it, expect, vi } from 'vitest'
import { visibleLength, pad, sanitizeAnsi, truncate } from '../../../../apps/console/src/ansi.ts'
import { action, actions, composeActions, footerActionsFromHints, renderActionFooter } from '../../../../apps/console/src/actions.ts'
import { formatDateTime, formatDateTimeOrValue } from '../../../../apps/console/src/format.ts'
import { parseKey } from '../../../../apps/console/src/keys.ts'
import { App, type View } from '../../../../apps/console/src/screen.ts'

describe('ansi visibleLength', () => {
  it('counts only printable characters, ignoring SGR escapes', () => {
    expect(visibleLength('hello')).toBe(5)
    expect(visibleLength('\u001b[1mbold\u001b[0m')).toBe(4)
    expect(visibleLength('\u001b[38;5;76mgreen\u001b[0m text')).toBe(10)
  })
})

describe('ansi pad', () => {
  it('right-pads to the requested visible width', () => {
    expect(pad('a', 4)).toBe('a   ')
    expect(pad('\u001b[1mab\u001b[0m', 4)).toBe('\u001b[1mab\u001b[0m  ')
  })

  it('returns the original string when already wide enough', () => {
    expect(pad('hello', 3)).toBe('hello')
  })
})

describe('ansi truncate', () => {
  it('appends an ellipsis when content exceeds width', () => {
    expect(truncate('abcdef', 4)).toBe('abc…')
  })

  it('preserves SGR escape codes inside the truncated region', () => {
    const out = truncate('\u001b[1mabcdef\u001b[0m', 4)
    expect(out.startsWith('\u001b[1m')).toBe(true)
    expect(out.endsWith('…')).toBe(true)
    expect(visibleLength(out)).toBe(4)
  })

  it('passes through short strings unchanged', () => {
    expect(truncate('ab', 5)).toBe('ab')
  })
})

describe('ansi sanitizeAnsi', () => {
  it('strips ESC and other C0/C1 control bytes from untrusted strings', () => {
    expect(sanitizeAnsi('hi\u001b[2Joops')).toBe('hi[2Joops')
    expect(sanitizeAnsi('a\u0007b\u0008c\u007fd')).toBe('abcd')
    expect(sanitizeAnsi('preserve tabs\tand\nnewlines')).toBe('preserve tabs\tand\nnewlines')
  })

  it('neutralizes a malicious title-set sequence sourced from API data', () => {
    const evil = '\u001b]0;hijacked\u0007legit'
    const out = sanitizeAnsi(evil)
    expect(out.includes('\u001b')).toBe(false)
    expect(out.includes('\u0007')).toBe(false)
    expect(out).toContain('legit')
  })
})

describe('action footer', () => {
  it('groups actions and drops utility commands first under narrow widths', () => {
    const footer = renderActionFooter(composeActions([
      actions.open,
      actions.new,
      actions.edit,
      actions.delete,
      actions.reload,
      actions.info,
      actions.copyName,
      actions.revealId,
      actions.back,
      actions.quit,
    ], { selection: 'single' }), { width: 72 })
    const plain = stripSgr(footer)

    expect(plain).toContain('enter  open')
    expect(plain).toContain('n  new')
    expect(plain).toContain('|')
    expect(plain).not.toContain('copy-name')
    expect(visibleLength(footer)).toBeLessThanOrEqual(72)
  })

  it('filters hidden and disabled actions from context', () => {
    const footer = renderActionFooter(composeActions([
      actions.open,
      actions.delete,
      actions.reload,
      actions.copyId,
    ], {
      selection: 'none',
      flags: ['loading'],
    }), { width: 80 })
    const plain = stripSgr(footer)

    expect(plain).not.toContain('open')
    expect(plain).not.toContain('delete')
    expect(plain).not.toContain('reload')
  })

  it('infers action priority and group from free-form hints', () => {
    const footer = renderActionFooter(footerActionsFromHints([
      'enter:open',
      '?:help',
      'Y:copy page',
      'esc:cancel',
      'custom action',
    ]), { width: 120 })
    const plain = stripSgr(footer)

    expect(plain).toContain('enter  open')
    expect(plain).toContain('?  help')
    expect(plain).toContain('Y  copy page')
    expect(plain).toContain('esc  cancel')
    expect(plain).toContain('custom action')
  })

  it('resolves custom actions with exact selection, permissions, and default groups', () => {
    const definitions = [
      action({ id: 'approve', key: 'a', label: 'approve', priority: 'primary', requiresSelection: 'multiple', permissions: ['delegation.write'] }),
      action({ id: 'readonly', key: 'r', label: 'readonly', priority: 'secondary', requiredCapabilities: ['audit.read'] }),
      action({ id: 'debug-copy', key: 'd', label: 'debug-copy', priority: 'utility' }),
      action({ id: 'quit', key: 'q', label: 'quit', priority: 'secondary' }),
    ]

    const hidden = composeActions(definitions, { selection: 'single', permissions: ['delegation.write'] })
    const shown = composeActions(definitions, {
      selection: 'multiple',
      permissions: ['delegation.write'],
      capabilities: ['audit.read'],
    })

    expect(hidden.map((item) => item.id)).not.toContain('approve')
    expect(shown.map((item) => item.id)).toEqual(['approve', 'readonly', 'quit', 'debug-copy'])
  })
})

describe('datetime formatting', () => {
  it('renders ISO timestamps as readable UTC values with source labels', () => {
    expect(formatDateTime('2026-05-28T04:48:55.460Z')).toBe('28 May 2026, 04:48:55 UTC')
  })

  it('uses compact readable timestamps for narrow table columns', () => {
    expect(formatDateTimeOrValue('2026-05-28T04:48:55.460Z', { compact: true })).toBe('28 May, 04:48 UTC')
  })

  it('preserves explicit timezone offsets', () => {
    expect(formatDateTime('2026-05-28T10:18:55+05:30')).toBe('28 May 2026, 10:18:55 UTC+05:30')
  })
})

describe('parseKey', () => {
  it('decodes arrow keys', () => {
    expect(parseKey('\u001b[A')).toBe('up')
    expect(parseKey('\u001b[B')).toBe('down')
    expect(parseKey('\u001b[C')).toBe('right')
    expect(parseKey('\u001b[D')).toBe('left')
  })

  it('decodes navigation keys', () => {
    expect(parseKey('\u001b[5~')).toBe('pgup')
    expect(parseKey('\u001b[6~')).toBe('pgdn')
    expect(parseKey('\u001b[H')).toBe('home')
    expect(parseKey('\u001b[F')).toBe('end')
  })

  it('decodes Enter, Esc, Tab, Backspace, Ctrl-C', () => {
    expect(parseKey('\r')).toBe('enter')
    expect(parseKey('\n')).toBe('enter')
    expect(parseKey('\u001b')).toBe('esc')
    expect(parseKey('\t')).toBe('tab')
    expect(parseKey('\u007f')).toBe('backspace')
    expect(parseKey('\u0003')).toBe('ctrl-c')
  })

  it('passes through plain characters', () => {
    expect(parseKey('q')).toBe('q')
    expect(parseKey('z')).toBe('z')
  })
})

describe('App key dispatch', () => {
  function makeView(isTextEntry: boolean): { view: View; seen: string[] } {
    const seen: string[] = []
    return {
      seen,
      view: {
        title: 't',
        isTextEntry,
        hints: () => [],
        render: () => [],
        onKey: (key: string) => { seen.push(key) },
      } as View,
    }
  }

  it('omits breadcrumb text for the root view', () => {
    const app = new App('', '')
    const { view } = makeView(false)
    view.title = 'menu'
    ;(app as unknown as { stack: View[] }).stack = [view]

    const line = (app as unknown as { titleLine(sz: { rows: number; cols: number }): string }).titleLine({ rows: 10, cols: 20 })

    expect(line).toBe(' '.repeat(20))
  })

  it('shows breadcrumbs after opening a child view', () => {
    const app = new App('', '')
    const parent = makeView(false).view
    const child = makeView(false).view
    parent.title = 'menu'
    child.title = 'zones'
    ;(app as unknown as { stack: View[] }).stack = [parent, child]

    const line = (app as unknown as { titleLine(sz: { rows: number; cols: number }): string }).titleLine({ rows: 10, cols: 40 })

    expect(line).toContain('menu')
    expect(line).toContain('zones')
    expect(visibleLength(line.trimEnd())).toBe(' menu / zones'.length)
  })

  it('renders the default ready footer status in green', () => {
    const app = new App('', '')

    const line = (app as unknown as { statusLine(sz: { rows: number; cols: number }): string }).statusLine({ rows: 10, cols: 20 })

    expect(line).toContain('\u001b[38;5;76m')
    expect(stripSgr(line)).toBe(' ready' + ' '.repeat(14))
  })

  it('renders unhealthy footer status in red', () => {
    const app = new App('', '')
    ;(app as unknown as { setStatus(text: string, kind?: 'info' | 'error'): void }).setStatus('unhealthy')

    const line = (app as unknown as { statusLine(sz: { rows: number; cols: number }): string }).statusLine({ rows: 10, cols: 20 })

    expect(line).toContain('\u001b[38;5;196m')
    expect(stripSgr(line)).toBe(' unhealthy' + ' '.repeat(10))
  })

  it('routes q to exit when current view is not text-entry', async () => {
    const app = new App('', '')
    const exit = vi.spyOn(app, 'exit').mockImplementation(async () => {})
    const { view, seen } = makeView(false)
    ;(app as unknown as { stack: View[] }).stack = [view]
    await (app as unknown as { dispatchKey(k: string): Promise<void> }).dispatchKey('q')
    expect(exit).toHaveBeenCalled()
    expect(seen).toEqual([])
  })

  it('forwards q to the view when isTextEntry is true', async () => {
    const app = new App('', '')
    const exit = vi.spyOn(app, 'exit').mockImplementation(async () => {})
    const { view, seen } = makeView(true)
    ;(app as unknown as { stack: View[] }).stack = [view]
    await (app as unknown as { dispatchKey(k: string): Promise<void> }).dispatchKey('q')
    expect(exit).not.toHaveBeenCalled()
    expect(seen).toEqual(['q'])
  })

  it('push and replaceTop surface init failures as status errors', async () => {
    const app = new App('', '')
    const failing = makeView(false).view
    failing.init = async () => { throw new Error('boom') }

    app.push(failing)
    await Promise.resolve()

    expect((app as unknown as { status: string }).status).toContain('init:')

    const replacement = makeView(false).view
    replacement.init = async () => { throw new Error('replace boom') }
    app.replaceTop(replacement)
    await Promise.resolve()

    expect((app as unknown as { status: string }).status).toContain('replace boom')
  })

  it('pop disposes nested views and exits from the root view', async () => {
    const app = new App('', '')
    const dispose = vi.fn()
    const parent = makeView(false).view
    const child = makeView(false).view
    child.dispose = dispose
    ;(app as unknown as { stack: View[] }).stack = [parent, child]

    app.pop()

    expect(dispose).toHaveBeenCalled()
    expect((app as unknown as { stack: View[] }).stack).toEqual([parent])

    const exit = vi.spyOn(app, 'exit').mockImplementation(async () => {})
    app.pop()
    expect(exit).toHaveBeenCalled()
  })

  it('renders banner text with dynamic right-hand content', () => {
    const app = new App('Caracal Console', () => 'zone: Pied Piper Production')

    const line = (app as unknown as { bannerLine(sz: { rows: number; cols: number }): string }).bannerLine({ rows: 10, cols: 60 })

    expect(stripSgr(line)).toContain('Caracal Console')
    expect(stripSgr(line)).toContain('zone: Pied Piper Production')
  })

  it('updates dynamic banner text and marks the screen dirty', () => {
    const app = new App('Caracal Console', 'initial')

    app.setBannerRight(() => 'zone: Hooli QA')

    expect(app.bannerRight).toBe('zone: Hooli QA')
    expect((app as unknown as { dirty: boolean }).dirty).toBe(true)
  })

  it('renders a complete frame with status and footer actions', () => {
    const app = new App('Caracal Console', 'zone: Pied Piper Production')
    const view = makeView(false).view
    view.title = 'dashboard'
    view.hints = () => ['enter:open']
    view.render = () => ['row one', 'row two']
    ;(app as unknown as { stack: View[] }).stack = [view]
    Object.defineProperty(process.stdout, 'rows', { configurable: true, value: 12 })
    Object.defineProperty(process.stdout, 'columns', { configurable: true, value: 80 })
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    ;(app as unknown as { renderFrame(): void }).renderFrame()

    const output = String(write.mock.calls[0][0])
    expect(stripSgr(output)).toContain('Caracal Console')
    expect(stripSgr(output)).toContain('dashboard')
    expect(stripSgr(output)).toContain('row one')
    expect(stripSgr(output)).toContain('enter  open')
    expect(stripSgr(output)).toContain('q  quit')
    write.mockRestore()
  })

  it('omits implicit quit footer action for text-entry views', () => {
    const app = new App('', '')
    const view = makeView(true).view

    const line = (app as unknown as { hintsLine(view: View, sz: { rows: number; cols: number }): string }).hintsLine(view, { rows: 10, cols: 80 })

    expect(stripSgr(line)).not.toContain('q  quit')
  })
})

function stripSgr(value: string): string {
  return value.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
}
