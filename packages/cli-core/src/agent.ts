// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb bodies for `caracal agent …` coordinator commands.

import type { AdminClient, AgentSession } from '@caracalai/admin'

export interface AgentListOpts { client: AdminClient; zoneId: string }
export interface AgentIdOpts { client: AdminClient; zoneId: string; id: string }

export function ensureCoordinatorToken(): void {
  if (!process.env.CARACAL_COORDINATOR_TOKEN) {
    throw new Error(
      'CARACAL_COORDINATOR_TOKEN required (JWT issued by STS with scope "agent:lifecycle"); set it before invoking agent/delegation commands.',
    )
  }
}

export function agentList(opts: AgentListOpts): Promise<AgentSession[]> {
  return opts.client.agents.list(opts.zoneId)
}

export function agentGet(opts: AgentIdOpts): Promise<AgentSession> {
  return opts.client.agents.get(opts.zoneId, opts.id)
}

export function agentTree(opts: AgentIdOpts): Promise<AgentSession[]> {
  return opts.client.agents.children(opts.zoneId, opts.id)
}

export function agentSuspend(opts: AgentIdOpts): Promise<{ suspended: true }> {
  return opts.client.agents.suspend(opts.zoneId, opts.id)
}

export function agentResume(opts: AgentIdOpts): Promise<{ resumed: true }> {
  return opts.client.agents.resume(opts.zoneId, opts.id)
}

export function agentTerminate(opts: AgentIdOpts): Promise<void> {
  return opts.client.agents.terminate(opts.zoneId, opts.id)
}
