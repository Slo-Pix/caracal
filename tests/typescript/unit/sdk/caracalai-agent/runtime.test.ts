// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent runtime unit tests for token exchange option forwarding.

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentServiceConfig } from '../../../../../packages/caracalai-agent/src/types.js'
import { AgentRuntime } from '../../../../../packages/caracalai-agent/src/runtime.js'

const config: AgentServiceConfig = {
  id: 'agent-a',
  url: 'https://agent.example.com',
  zoneId: 'zone1',
  clientId: 'zone1:agent-a',
  subjectToken: 'subject-token',
  clientSecret: 'secret',
  sessionId: 'sid-1',
  agentSessionId: 'agent-session-1',
  delegationEdgeId: 'edge-1',
}

describe('AgentRuntime', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exposes service URL as the resource audience', () => {
    const runtime = new AgentRuntime(config, 'https://sts.example.com')

    expect(runtime.serviceUrl).toBe('https://agent.example.com')
    expect(runtime.audience).toBe('https://agent.example.com')
  })

  it('forwards configured credentials and token options to OAuth exchange', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tool-token', expires_in: 900 }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const runtime = new AgentRuntime(config, 'https://sts.example.com')

    const token = await runtime.getToolToken('resource://tool', {
      scopes: ['invoke'],
      agentSessionId: 'agent-session-override',
      ttlSeconds: 120,
    })

    expect(token).toBe('tool-token')
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams
    expect(fetchMock.mock.calls[0][0]).toBe('https://sts.example.com/oauth/2/token')
    expect(body.get('client_id')).toBe('zone1:agent-a')
    expect(body.get('client_secret')).toBe('secret')
    expect(body.get('subject_token')).toBe('subject-token')
    expect(body.get('resource')).toBe('resource://tool')
    expect(body.get('scope')).toBe('invoke')
    expect(body.get('session_id')).toBe('sid-1')
    expect(body.get('agent_session_id')).toBe('agent-session-override')
    expect(body.get('delegation_edge_id')).toBe('edge-1')
    expect(body.get('ttl_seconds')).toBe('120')
  })
})