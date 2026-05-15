// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// run-form argv tokenizer + env injection contract.

import { describe, it, expect } from 'vitest'
import { __testInternals } from '../../../../apps/tui/src/views/menu.ts'

const { tokenizeArgv, parseEnv } = __testInternals

describe('tokenizeArgv', () => {
  it('splits on whitespace honoring quotes', () => {
    expect(tokenizeArgv('echo  hello "two words" \'quoted\'')).toEqual(['echo', 'hello', 'two words', 'quoted'])
  })

  it('rejects NUL byte', () => {
    expect(() => tokenizeArgv('bad\u0000token')).toThrow(/NUL/)
  })

  it('rejects unterminated quote', () => {
    expect(() => tokenizeArgv('echo "open')).toThrow(/unterminated/)
  })

  it('returns empty list for empty input', () => {
    expect(tokenizeArgv('')).toEqual([])
  })
})

describe('parseEnv', () => {
  it('parses csv KEY=VAL pairs', () => {
    expect(parseEnv('A=1,B=two')).toEqual({ A: '1', B: 'two' })
  })

  it('throws when an entry lacks =', () => {
    expect(() => parseEnv('A=1,broken')).toThrow(/missing '='/)
  })
})
