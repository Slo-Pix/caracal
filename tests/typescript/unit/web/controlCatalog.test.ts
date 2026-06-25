// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Guards that the web Control permission catalog stays a complete mirror of the engine surface.

import { describe, expect, it } from 'vitest'

import { controlPermissions, controlScopes } from '@caracalai/engine'

import {
  CONTROL_NOUN_DESCRIPTIONS,
  CONTROL_PERMISSIONS,
  CONTROL_SCOPES,
} from '../../../../apps/web/src/platform/api/controlCatalog.ts'

describe('web control catalog parity with engine', () => {
  it('exposes exactly the engine control scopes', () => {
    const webScopes = CONTROL_PERMISSIONS.map((permission) => permission.scope).sort()
    expect(webScopes).toEqual(controlScopes())
  })

  it('keeps CONTROL_SCOPES aligned with the engine surface', () => {
    expect([...CONTROL_SCOPES].sort()).toEqual(controlScopes())
  })

  it('derives each permission action and verb from its scope', () => {
    for (const permission of CONTROL_PERMISSIONS) {
      const action = permission.scope.split(':').at(-1)
      expect(permission.action).toBe(action)
      expect(permission.verb).toBe(action)
      expect(permission.scope).toBe(`control:${permission.command}:${permission.verb}`)
    }
  })

  it('matches the engine command/action pairing for every scope', () => {
    const enginePairs = new Set(
      controlPermissions().map((permission) => `${permission.command}:${permission.action}`),
    )
    const webPairs = new Set(
      CONTROL_PERMISSIONS.map((permission) => `${permission.command}:${permission.action}`),
    )
    expect(webPairs).toEqual(enginePairs)
  })

  it('describes every noun surfaced in the catalog', () => {
    for (const permission of CONTROL_PERMISSIONS) {
      expect(CONTROL_NOUN_DESCRIPTIONS[permission.command]).toBeTruthy()
    }
  })
})
