// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent HTTP route helper tests for the framework-neutral protocol contract.

import { describe, it, expect } from 'vitest'
import { createAgentHttpRoutes, createAgentServer, createAuthorizedAgentHttpRoutes } from '../../../../../packages/caracalai-agent/src/server.js'
import type { AgentManifest, InvocationEnvelope, StreamEvent } from '../../../../../packages/caracalai-agent/src/types.js'

const manifest: AgentManifest = {
  id: 'svc-1',
  name: 'worker',
  endpoint: {
    url: 'https://agent.example.test',
    protocolVersions: ['2026-03-16'],
    transports: ['http', 'sse'],
  },
  capabilities: ['summarize'],
}

const authorize = (_auth: { authorization?: string }, envelope: InvocationEnvelope): InvocationEnvelope => ({
  ...envelope,
  clientId: envelope.clientId ?? 'zone1:app1',
  zoneId: envelope.zoneId ?? 'zone1',
})

describe('createAgentHttpRoutes', () => {
  it('serves manifest and heartbeat contracts', async () => {
    const routes = createAgentHttpRoutes(createAgentServer(manifest, {
      invoke: async (envelope) => ({ requestId: envelope.requestId, result: 'ok' }),
    }))

    await expect(routes.manifest()).resolves.toMatchObject({ status: 200, body: manifest })
    await expect(routes.heartbeat()).resolves.toMatchObject({
      status: 200,
      body: { serviceId: 'svc-1', status: 'healthy', activeInvocations: 0 },
    })
  })

  it('invokes and cancels with stable error envelopes', async () => {
    const routes = createAuthorizedAgentHttpRoutes(createAgentServer(manifest, {
      invoke: async (envelope) => ({ requestId: envelope.requestId, result: envelope.params }),
    }), authorize)

    const envelope: InvocationEnvelope = { requestId: 'req-1', method: 'run', params: { value: 1 } }
    await expect(routes.invoke(envelope)).resolves.toMatchObject({
      status: 200,
      body: { requestId: 'req-1', result: { value: 1 } },
    })
    await expect(routes.cancel({ requestId: 'req-1' })).resolves.toMatchObject({
      status: 200,
      body: { requestId: 'req-1', error: { code: 'cancel_unsupported' } },
    })
  })

  it('serializes stream events as server-sent events', async () => {
    async function* stream(envelope: InvocationEnvelope): AsyncIterable<StreamEvent> {
      yield { requestId: envelope.requestId, sequence: 0, event: 'start' }
      yield { requestId: envelope.requestId, sequence: 1, event: 'complete', data: { done: true } }
    }
    const routes = createAuthorizedAgentHttpRoutes(createAgentServer(manifest, {
      invoke: async (envelope) => ({ requestId: envelope.requestId, result: 'ok' }),
      stream,
    }), authorize)

    const res = await routes.stream({ requestId: 'req-2', method: 'run', params: {} })
    expect(res.status).toBe(200)
    expect(res.headers['Content-Type']).toBe('text/event-stream')
    expect(res.body).toContain('event: start')
    expect(res.body).toContain('event: complete')
  })

  it('maps thrown handler failures to invocation errors', async () => {
    const routes = createAuthorizedAgentHttpRoutes(createAgentServer(manifest, {
      invoke: async () => {
        throw new Error('boom')
      },
    }), authorize)

    await expect(routes.invoke({ requestId: 'req-3', method: 'run', params: {} })).resolves.toMatchObject({
      status: 500,
      body: { requestId: 'req-3', error: { code: 'agent_handler_failed', message: 'boom' } },
    })
  })

  it('denies protected routes without an authorizer', async () => {
    const routes = createAgentHttpRoutes(createAgentServer(manifest, {
      invoke: async (envelope) => ({ requestId: envelope.requestId, result: 'ok' }),
    }))

    await expect(routes.invoke({ requestId: 'req-4', method: 'run', params: {} })).resolves.toMatchObject({
      status: 401,
      body: { error: { code: 'missing_authorizer' } },
    })
  })
})