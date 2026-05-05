// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// ANSI helpers and key parser unit tests.

import { describe, it, expect } from 'vitest'
import { visibleLength, pad, truncate } from '../../../../apps/tui/src/ansi.ts'
import { parseKey } from '../../../../apps/tui/src/keys.ts'

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
