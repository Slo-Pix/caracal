// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Draft pipeline tests cover dependency-ordered commit, output wiring, skip, and graph validation.

import { describe, expect, it, vi } from 'vitest'

import { DraftPipeline } from '../../../../apps/console/src/draft.ts'

describe('DraftPipeline', () => {
  it('commits independent stages in registration order', async () => {
    const seen: string[] = []
    const pipeline = new DraftPipeline()
    pipeline.stage('a', { commit: () => { seen.push('a'); return 1 } })
    pipeline.stage('b', { commit: () => { seen.push('b'); return 2 } })

    const out = await pipeline.commit()

    expect(seen).toEqual(['a', 'b'])
    expect(out.get<number>('a')).toBe(1)
    expect(out.get<number>('b')).toBe(2)
  })

  it('commits dependencies before dependents regardless of registration order', async () => {
    const seen: string[] = []
    const pipeline = new DraftPipeline()
    pipeline.stage('resource', {
      dependsOn: ['provider'],
      commit: (r) => { seen.push('resource'); return { providerId: r.get<string>('provider') } },
    })
    pipeline.stage('provider', { commit: () => { seen.push('provider'); return 'provider-1' } })

    const out = await pipeline.commit()

    expect(seen).toEqual(['provider', 'resource'])
    expect(out.get<{ providerId: string }>('resource').providerId).toBe('provider-1')
  })

  it('skips a stage and lets dependents detect the skip', async () => {
    const commitPolicy = vi.fn(() => 'policy')
    const pipeline = new DraftPipeline()
    pipeline.stage('resource', { commit: () => 'resource' })
    pipeline.stage('policy', { dependsOn: ['resource'], skip: () => true, commit: commitPolicy })

    const out = await pipeline.commit()

    expect(commitPolicy).not.toHaveBeenCalled()
    expect(out.has('policy')).toBe(false)
    expect(out.has('resource')).toBe(true)
  })

  it('throws when a dependency cycle is present', async () => {
    const pipeline = new DraftPipeline()
    pipeline.stage('a', { dependsOn: ['b'], commit: () => 1 })
    pipeline.stage('b', { dependsOn: ['a'], commit: () => 2 })

    await expect(pipeline.commit()).rejects.toThrow(/dependency cycle/)
  })

  it('throws when a stage depends on an unknown stage', async () => {
    const pipeline = new DraftPipeline()
    pipeline.stage('a', { dependsOn: ['missing'], commit: () => 1 })

    await expect(pipeline.commit()).rejects.toThrow(/unknown stage "missing"/)
  })

  it('rejects duplicate stage keys', () => {
    const pipeline = new DraftPipeline()
    pipeline.stage('a', { commit: () => 1 })

    expect(() => pipeline.stage('a', { commit: () => 2 })).toThrow(/already defined/)
  })

  it('throws when reading a stage that has not committed', async () => {
    const pipeline = new DraftPipeline()
    pipeline.stage('a', {
      commit: (r) => r.get<number>('b'),
    })

    await expect(pipeline.commit()).rejects.toThrow(/not committed/)
  })
})
