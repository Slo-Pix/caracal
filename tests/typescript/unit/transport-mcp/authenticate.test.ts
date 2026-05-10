// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Transport MCP authentication unit tests.

import { describe, expect, it } from 'vitest'
import { authenticate, extractBearer } from '../../../../packages/transport/mcp/ts/src/authenticate.js'

describe('transport-mcp authentication', () => {
  it('extracts bearer tokens', () => {
    expect(extractBearer('Bearer token-1')).toBe('token-1')
    expect(extractBearer('bearer token-1')).toBeNull()
    expect(extractBearer('Bearer   ')).toBeNull()
    expect(extractBearer(undefined)).toBeNull()
  })

  it('rejects missing tokens without verification', async () => {
    const result = await authenticate('', {
      issuer: 'https://issuer.example.com',
      audience: 'resource://api',
      revocations: {
        isRevoked: () => false,
        markRevoked: () => undefined,
      },
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'missing_token', description: 'Missing bearer token' },
    })
  })
})
