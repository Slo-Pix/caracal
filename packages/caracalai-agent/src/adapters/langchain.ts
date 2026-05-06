// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// LangChain adapter: wraps the base adapter for LangChain agent execution context.

import { BaseAdapter } from './custom.js'
import type { AgentServiceConfig, ToolTokenOptions } from '../types.js'

export interface LangChainRunnable {
  invoke: (input: unknown) => Promise<unknown> | unknown
}

export interface LangChainTool {
  call: (input: unknown, ctx: { token: string }) => Promise<unknown> | unknown
}

export class LangChainAdapter extends BaseAdapter {
  constructor(
    config: AgentServiceConfig,
    stsUrl: string,
    private readonly runnable?: LangChainRunnable,
  ) {
    super(config, stsUrl)
  }

  async run(input: unknown): Promise<unknown> {
    if (!this.runnable) {
      throw new Error('LangChain runnable is required')
    }
    return this.runnable.invoke(input)
  }

  tool(resource: string, tool: LangChainTool, opts: ToolTokenOptions = {}): (input: unknown) => Promise<unknown> {
    return async (input: unknown): Promise<unknown> => {
      const token = await this.ctx.tool(resource, opts)
      return tool.call(input, { token })
    }
  }
}
