// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent adapter unit tests for framework wrappers and tool context behavior.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentServiceConfig } from '../../../../../packages/caracalai-agent/src/types.js'
import { CustomPipelineAdapter } from '../../../../../packages/caracalai-agent/src/adapters/custom.js'
import { CrewAIAdapter } from '../../../../../packages/caracalai-agent/src/adapters/crewai.js'
import { LangChainAdapter } from '../../../../../packages/caracalai-agent/src/adapters/langchain.js'

const config: AgentServiceConfig = {
  id: 'agent-a',
  url: 'https://agent.example.com',
  zoneId: 'zone1',
  clientId: 'zone1:agent-a',
  subjectToken: 'subject-token',
  agentSessionId: 'agent-session-1',
}

describe('CustomPipelineAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tool-token', expires_in: 900 }),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('runs pipeline steps in order with adapter context', async () => {
    const adapter = new CustomPipelineAdapter(config, 'https://sts.example.com', [
      (input) => ({ ...(input as Record<string, unknown>), first: true }),
      async (input, ctx) => ({ ...(input as Record<string, unknown>), token: await ctx.tool('resource://tool') }),
    ])

    await expect(adapter.run({ requestId: 'req-1', method: 'run', params: { value: 1 } })).resolves.toEqual({
      requestId: 'req-1',
      result: { value: 1, first: true, token: 'tool-token' },
    })
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams
    expect(body.get('agent_session_id')).toBe('agent-session-1')
  })
})

describe('CrewAIAdapter', () => {
  it('requires a task before running', async () => {
    const adapter = new CrewAIAdapter(config, 'https://sts.example.com')

    await expect(adapter.run({ value: 1 })).rejects.toThrow('CrewAI task is required')
  })

  it('delegates execution to the task', async () => {
    const task = { execute: vi.fn().mockResolvedValue({ result: 'ok' }) }
    const adapter = new CrewAIAdapter(config, 'https://sts.example.com', task)

    await expect(adapter.run({ value: 1 })).resolves.toEqual({ result: 'ok' })
    expect(task.execute).toHaveBeenCalledWith({ value: 1 })
  })
})

describe('LangChainAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'tool-token', expires_in: 900 }),
    }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires a runnable before running', async () => {
    const adapter = new LangChainAdapter(config, 'https://sts.example.com')

    await expect(adapter.run({ value: 1 })).rejects.toThrow('LangChain runnable is required')
  })

  it('wraps tools with resource tokens', async () => {
    const runnable = { invoke: vi.fn() }
    const tool = { call: vi.fn().mockResolvedValue('done') }
    const adapter = new LangChainAdapter(config, 'https://sts.example.com', runnable)

    const wrapped = adapter.tool('resource://tool', tool, { scopes: ['invoke'] })

    await expect(wrapped({ prompt: 'go' })).resolves.toBe('done')
    expect(tool.call).toHaveBeenCalledWith({ prompt: 'go' }, { token: 'tool-token' })
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as URLSearchParams
    expect(body.get('scope')).toBe('invoke')
  })
})