// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Verb bodies for `caracal app …` admin commands.

import type {
  AdminClient,
  Application,
  ApplicationInput,
  DCRInput,
} from '@caracalai/admin'

export interface AppListOpts {
  client: AdminClient
  zoneId: string
}

export interface AppIdOpts {
  client: AdminClient
  zoneId: string
  id: string
}

export interface AppCreateOpts {
  client: AdminClient
  zoneId: string
  input: ApplicationInput
}

export interface AppPatchOpts {
  client: AdminClient
  zoneId: string
  id: string
  input: Partial<ApplicationInput>
}

export interface AppDcrOpts {
  client: AdminClient
  zoneId: string
  input: DCRInput
}

export function appList(opts: AppListOpts): Promise<Application[]> {
  return opts.client.applications.list(opts.zoneId)
}

export function appGet(opts: AppIdOpts): Promise<Application> {
  return opts.client.applications.get(opts.zoneId, opts.id)
}

export function appCreate(opts: AppCreateOpts): Promise<Application> {
  return opts.client.applications.create(opts.zoneId, opts.input)
}

export function appPatch(opts: AppPatchOpts): Promise<Application> {
  return opts.client.applications.patch(opts.zoneId, opts.id, opts.input)
}

export function appDelete(opts: AppIdOpts): Promise<void> {
  return opts.client.applications.delete(opts.zoneId, opts.id)
}

export function appDcr(opts: AppDcrOpts): Promise<unknown> {
  return opts.client.applications.dcr(opts.zoneId, opts.input)
}
