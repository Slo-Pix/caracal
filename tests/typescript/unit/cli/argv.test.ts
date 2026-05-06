// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// CLI argv normalization tests for pnpm script forwarding.

import { describe, expect, test } from 'vitest'

function normalizeArgs(argv: string[]): string[] {
  return argv[0] === '--' ? argv.slice(1) : argv
}

describe('CLI argv normalization', () => {
  test('drops a leading pnpm separator', () => {
    expect(normalizeArgs(['--', 'run', 'env'])).toEqual(['run', 'env'])
  })

  test('leaves direct argv untouched', () => {
    expect(normalizeArgs(['credential', 'read', 'resource://example'])).toEqual([
      'credential',
      'read',
      'resource://example',
    ])
  })
})