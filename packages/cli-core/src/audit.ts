// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb bodies for `caracal audit …` and `caracal explain …` debuggability commands.

import type { AdminClient, AuditDetail, AuditEvent, AuditQuery } from '@caracalai/admin'

export interface AuditTailOpts {
  client: AdminClient
  zoneId: string
  query?: AuditQuery
}

export interface AuditExplainOpts {
  client: AdminClient
  zoneId: string
  requestId: string
}

// One-shot fetch of recent audit events. The TUI can wrap this in its own
// polling loop and surface lines through onLine; the CLI uses it directly.
export function auditTail(opts: AuditTailOpts): Promise<AuditEvent[]> {
  return opts.client.audit.list(opts.zoneId, opts.query)
}

export function auditExplain(opts: AuditExplainOpts): Promise<AuditDetail[]> {
  return opts.client.audit.byRequest(opts.zoneId, opts.requestId)
}
