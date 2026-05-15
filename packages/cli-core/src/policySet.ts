// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb bodies for `caracal policy-set …` admin commands.

import type { AdminClient, PolicySet, PolicySetVersion } from '@caracalai/admin'

export interface PolicySetListOpts { client: AdminClient; zoneId: string }
export interface PolicySetIdOpts { client: AdminClient; zoneId: string; id: string }
export interface PolicySetCreateOpts {
  client: AdminClient
  zoneId: string
  name: string
  description?: string
}
export interface PolicySetVersionOpts {
  client: AdminClient
  zoneId: string
  id: string
  policyVersionIds: string[]
}
export interface PolicySetActivateOpts {
  client: AdminClient
  zoneId: string
  id: string
  versionId: string
  shadowVersionId?: string
}

export function policySetList(opts: PolicySetListOpts): Promise<PolicySet[]> {
  return opts.client.policySets.list(opts.zoneId)
}

export function policySetGet(opts: PolicySetIdOpts): Promise<PolicySet> {
  return opts.client.policySets.get(opts.zoneId, opts.id)
}

export function policySetCreate(opts: PolicySetCreateOpts): Promise<PolicySet> {
  return opts.client.policySets.create(opts.zoneId, opts.name, opts.description)
}

export function policySetVersion(opts: PolicySetVersionOpts): Promise<PolicySetVersion> {
  const manifest = opts.policyVersionIds.map((policy_version_id) => ({ policy_version_id }))
  return opts.client.policySets.addVersion(opts.zoneId, opts.id, manifest)
}

export function policySetActivate(
  opts: PolicySetActivateOpts,
): Promise<{ activated: boolean; version_id: string; shadow_version_id: string | null }> {
  return opts.client.policySets.activate(opts.zoneId, opts.id, opts.versionId, opts.shadowVersionId)
}

export function policySetDelete(opts: PolicySetIdOpts): Promise<void> {
  return opts.client.policySets.delete(opts.zoneId, opts.id)
}
