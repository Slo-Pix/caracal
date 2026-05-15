// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb bodies for `caracal policy …` admin commands.

import type {
  AdminClient,
  Policy,
  PolicyInput,
  PolicyVersion,
} from '@caracalai/admin'

export interface PolicyListOpts { client: AdminClient; zoneId: string }
export interface PolicyIdOpts { client: AdminClient; zoneId: string; id: string }
export interface PolicyCreateOpts { client: AdminClient; zoneId: string; input: PolicyInput }
export interface PolicyVersionOpts {
  client: AdminClient
  zoneId: string
  id: string
  content: string
  schemaVersion?: string
}

export function policyList(opts: PolicyListOpts): Promise<Policy[]> {
  return opts.client.policies.list(opts.zoneId)
}

export function policyGet(opts: PolicyIdOpts): Promise<Policy & { versions: PolicyVersion[] }> {
  return opts.client.policies.get(opts.zoneId, opts.id)
}

export function policyCreate(opts: PolicyCreateOpts): Promise<Policy & { version: PolicyVersion }> {
  return opts.client.policies.create(opts.zoneId, opts.input)
}

export function policyVersion(opts: PolicyVersionOpts): Promise<PolicyVersion> {
  return opts.client.policies.addVersion(opts.zoneId, opts.id, opts.content, opts.schemaVersion)
}

export function policyDelete(opts: PolicyIdOpts): Promise<void> {
  return opts.client.policies.delete(opts.zoneId, opts.id)
}
