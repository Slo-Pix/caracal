// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb bodies for `caracal provider …` admin commands.

import type { AdminClient, Provider, ProviderInput } from '@caracalai/admin'

export interface ProviderListOpts { client: AdminClient; zoneId: string }
export interface ProviderIdOpts { client: AdminClient; zoneId: string; id: string }
export interface ProviderCreateOpts { client: AdminClient; zoneId: string; input: ProviderInput }
export interface ProviderPatchOpts { client: AdminClient; zoneId: string; id: string; input: Partial<ProviderInput> }

export function providerList(opts: ProviderListOpts): Promise<Provider[]> {
  return opts.client.providers.list(opts.zoneId)
}

export function providerGet(opts: ProviderIdOpts): Promise<Provider> {
  return opts.client.providers.get(opts.zoneId, opts.id)
}

export function providerCreate(opts: ProviderCreateOpts): Promise<Provider> {
  return opts.client.providers.create(opts.zoneId, opts.input)
}

export function providerPatch(opts: ProviderPatchOpts): Promise<Provider> {
  return opts.client.providers.patch(opts.zoneId, opts.id, opts.input)
}

export function providerDelete(opts: ProviderIdOpts): Promise<void> {
  return opts.client.providers.delete(opts.zoneId, opts.id)
}
