// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb bodies for `caracal grant …` admin commands.

import type { AdminClient, Grant, GrantInput } from '@caracalai/admin'

export interface GrantListOpts { client: AdminClient; zoneId: string }
export interface GrantIdOpts { client: AdminClient; zoneId: string; id: string }
export interface GrantCreateOpts { client: AdminClient; zoneId: string; input: GrantInput }

export function grantList(opts: GrantListOpts): Promise<Grant[]> {
  return opts.client.grants.list(opts.zoneId)
}

export function grantGet(opts: GrantIdOpts): Promise<Grant> {
  return opts.client.grants.get(opts.zoneId, opts.id)
}

export function grantCreate(opts: GrantCreateOpts): Promise<Grant> {
  return opts.client.grants.create(opts.zoneId, opts.input)
}

export function grantRevoke(opts: GrantIdOpts): Promise<void> {
  return opts.client.grants.revoke(opts.zoneId, opts.id)
}
