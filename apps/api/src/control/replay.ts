// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// JTI replay cache: Redis-backed and fail-closed so control invocations stay single-use across API replicas.

import type { RedisClient } from '../redis.js'

export interface Replay {
  mark(jti: string, expEpochSec: number | undefined): Promise<boolean>
  ping(): Promise<void>
}

const REDIS_KEY_PREFIX = 'caracal:control:jti:'

export class RedisReplay implements Replay {
  private readonly client: RedisClient
  private readonly maxTtlMs: number

  constructor(client: RedisClient, maxTtlMs: number) {
    this.client = client
    this.maxTtlMs = maxTtlMs
  }

  async mark(jti: string, expEpochSec: number | undefined): Promise<boolean> {
    if (!jti) return false
    const now = await this.redisNowMs()
    let ttlMs = this.maxTtlMs
    if (expEpochSec) {
      const delta = expEpochSec * 1000 - now
      if (delta <= 0) return false
      if (delta < ttlMs) ttlMs = delta
    }
    if (ttlMs <= 0) return false
    try {
      const res = await this.client.set(REDIS_KEY_PREFIX + jti, '1', 'PX', ttlMs, 'NX')
      return res === 'OK'
    } catch {
      // Fail closed: if Redis is unreachable we cannot prove non-replay.
      return false
    }
  }

  async ping(): Promise<void> {
    await this.client.ping()
  }

  private async redisNowMs(): Promise<number> {
    if (typeof this.client.time !== 'function') return Date.now()
    const parts = await this.client.time()
    const seconds = Number(parts[0])
    const micros = Number(parts[1])
    if (Number.isFinite(seconds) && Number.isFinite(micros)) {
      return seconds * 1000 + Math.floor(micros / 1000)
    }
    throw new Error('redis TIME returned an invalid response')
  }
}
