// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb bodies for `caracal delegation …` coordinator commands.

import type { AdminClient, DelegationEdge, TraverseNode } from '@caracalai/admin'

export interface DelegationSessionOpts {
  client: AdminClient
  zoneId: string
  sessionId: string
}

export interface DelegationEdgeOpts {
  client: AdminClient
  zoneId: string
  id: string
}

export function delegationInbound(opts: DelegationSessionOpts): Promise<DelegationEdge[]> {
  return opts.client.delegations.inbound(opts.zoneId, opts.sessionId)
}

export function delegationOutbound(opts: DelegationSessionOpts): Promise<DelegationEdge[]> {
  return opts.client.delegations.outbound(opts.zoneId, opts.sessionId)
}

export function delegationTraverse(opts: DelegationEdgeOpts): Promise<TraverseNode[]> {
  return opts.client.delegations.traverse(opts.zoneId, opts.id)
}

export function delegationRevoke(
  opts: DelegationEdgeOpts,
): Promise<{ revoked_edges: number; affected_sessions: number }> {
  return opts.client.delegations.revoke(opts.zoneId, opts.id)
}
