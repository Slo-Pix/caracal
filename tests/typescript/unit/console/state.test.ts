// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Console state persistence tests cover safe operator context restoration.

import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { ConsoleStateStore } from '../../../../apps/console/src/state.ts'

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function statePath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'caracal-console-state-'))
  dirs.push(dir)
  return join(dir, 'console-state.json')
}

describe('ConsoleStateStore', () => {
  it('persists non-secret operator context with restricted file permissions', () => {
    const path = statePath()
    const state = new ConsoleStateStore(path)

    state.setSelectedZone('zone-1', 'prod')
    state.setMenuCursor(4)
    state.setListSelection('applications', 'app-1', 'zone-1')
    state.setAuditFilters('zone-1', { decision: 'deny', request_id: 'req-1', limit: 25 })
    state.setSessionFilters('zone-1', { status: 'active', subject_id: 'user-1', limit: 50 })

    const loaded = ConsoleStateStore.load(path)
    expect(loaded.selectedZoneId()).toBe('zone-1')
    expect(loaded.selectedZoneSlug()).toBe('prod')
    expect(loaded.menuCursor()).toBe(4)
    expect(loaded.listSelection('applications', 'zone-1')).toBe('app-1')
    expect(loaded.auditFilters('zone-1')).toMatchObject({ decision: 'deny', request_id: 'req-1', limit: 25 })
    expect(loaded.sessionFilters('zone-1')).toMatchObject({ status: 'active', subject_id: 'user-1', limit: 50 })
    expect(statSync(path).mode & 0o777).toBe(0o600)

    const raw = readFileSync(path, 'utf8')
    expect(raw).not.toContain('secret')
    expect(raw).not.toContain('token')
  })

  it('ignores unreadable or corrupt state and recovers on the next write', () => {
    const path = statePath()
    writeFileSync(path, '{not-json', { mode: 0o600 })

    const state = ConsoleStateStore.load(path)
    expect(state.selectedZoneId()).toBeUndefined()

    state.setSelectedZone('zone-2', undefined)
    expect(ConsoleStateStore.load(path).selectedZoneId()).toBe('zone-2')
  })

  it('persists the one-time guided setup completion flag', () => {
    const path = statePath()
    const state = new ConsoleStateStore(path)
    expect(state.setupCompleted()).toBe(false)

    state.markSetupCompleted()
    expect(state.setupCompleted()).toBe(true)
    expect(ConsoleStateStore.load(path).setupCompleted()).toBe(true)
  })
})
