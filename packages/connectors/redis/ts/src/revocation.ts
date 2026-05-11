// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Redis-backed revocation store and stream consumer for resource servers.

import { timingSafeEqual } from 'node:crypto'
import { signStream, STREAM_SIG_FIELD, type StreamValue } from '@caracalai/core'
import type { RevocationStore } from '@caracalai/revocation'

export const REVOCATION_STREAM = 'caracal.sessions.revoke'
export const DEFAULT_REVOCATION_TTL_MS = 24 * 60 * 60 * 1000

export interface RedisRevocationClient {
  get: (key: string) => Promise<string | null>
  set: (key: string, value: string, mode: 'PX', ttlMs: number) => Promise<unknown>
  xgroup?: (...args: string[]) => Promise<unknown>
  xreadgroup?: (...args: (string | number)[]) => Promise<RedisStreamResult | null>
  xack?: (stream: string, group: string, id: string) => Promise<unknown>
}

export type RedisStreamResult = Array<[string, Array<[string, string[]]>]>

export interface RedisRevocationStoreOptions {
  keyPrefix?: string
  defaultTtlMs?: number
  failClosed?: boolean
}

export class RedisRevocationStore implements RevocationStore {
  private readonly keyPrefix: string
  private readonly defaultTtlMs: number
  private readonly failClosed: boolean

  constructor(private readonly redis: RedisRevocationClient, opts: RedisRevocationStoreOptions = {}) {
    this.keyPrefix = opts.keyPrefix ?? 'caracal:revoked:sessions:'
    this.defaultTtlMs = opts.defaultTtlMs ?? DEFAULT_REVOCATION_TTL_MS
    this.failClosed = opts.failClosed ?? true
  }

  async isRevoked(sid: string): Promise<boolean> {
    if (sid === '') return false
    try {
      return await this.redis.get(this.key(sid)) !== null
    } catch (err) {
      if (this.failClosed) return true
      throw err
    }
  }

  async markRevoked(sid: string, ttlMs?: number): Promise<void> {
    if (sid === '') return
    await this.redis.set(this.key(sid), '1', 'PX', ttlMs ?? this.defaultTtlMs)
  }

  private key(sid: string): string {
    return `${this.keyPrefix}${sid}`
  }
}

export interface RedisRevocationConsumerOptions {
  stream?: string
  group?: string
  consumer: string
  batchSize?: number
  blockMs?: number
  streamHmacKey?: Buffer
  requireSignature?: boolean
}

export class RedisRevocationConsumer {
  private readonly stream: string
  private readonly group: string
  private readonly batchSize: number
  private readonly blockMs: number
  private readonly streamHmacKey: Buffer | undefined
  private readonly requireSignature: boolean

  constructor(
    private readonly redis: RedisRevocationClient,
    private readonly store: RedisRevocationStore,
    private readonly opts: RedisRevocationConsumerOptions,
  ) {
    this.stream = opts.stream ?? REVOCATION_STREAM
    this.group = opts.group ?? 'resource-revocation'
    this.batchSize = opts.batchSize ?? 50
    this.blockMs = opts.blockMs ?? 0
    this.streamHmacKey = opts.streamHmacKey
    this.requireSignature = opts.requireSignature ?? Boolean(opts.streamHmacKey)
    if (this.requireSignature && !this.streamHmacKey) {
      throw new Error('streamHmacKey is required when requireSignature is true')
    }
  }

  async ensureGroup(): Promise<void> {
    if (!this.redis.xgroup) throw new Error('redis client does not support xgroup')
    try {
      await this.redis.xgroup('CREATE', this.stream, this.group, '0', 'MKSTREAM')
    } catch (err) {
      if (!String((err as Error).message).includes('BUSYGROUP')) throw err
    }
  }

  async pollOnce(): Promise<number> {
    if (!this.redis.xreadgroup) throw new Error('redis client does not support xreadgroup')
    const rows = await this.redis.xreadgroup(
      'GROUP',
      this.group,
      this.opts.consumer,
      'COUNT',
      this.batchSize,
      'BLOCK',
      this.blockMs,
      'STREAMS',
      this.stream,
      '>',
    )
    let handled = 0
    for (const [, messages] of rows ?? []) {
      for (const [id, fields] of messages) {
        await this.processMessage(id, fields)
        handled++
      }
    }
    return handled
  }

  private async processMessage(id: string, fields: string[]): Promise<void> {
    const values = fieldsToValues(fields)
    if (!this.verify(values)) {
      await this.ack(id)
      return
    }
    const sid = values.session_id
    if (typeof sid === 'string' && sid !== '') {
      await this.store.markRevoked(sid)
    }
    await this.ack(id)
  }

  private verify(values: Record<string, StreamValue>): boolean {
    if (!this.requireSignature && !this.streamHmacKey) return true
    const got = values[STREAM_SIG_FIELD]
    if (typeof got !== 'string' || !this.streamHmacKey) return false
    const want = signStream(this.streamHmacKey, this.stream, values)
    const gotBytes = Buffer.from(got, 'hex')
    const wantBytes = Buffer.from(want, 'hex')
    return gotBytes.length === wantBytes.length && timingSafeEqual(gotBytes, wantBytes)
  }

  private async ack(id: string): Promise<void> {
    if (!this.redis.xack) throw new Error('redis client does not support xack')
    await this.redis.xack(this.stream, this.group, id)
  }
}

function fieldsToValues(fields: string[]): Record<string, StreamValue> {
  const out: Record<string, StreamValue> = {}
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i]
    if (key === undefined) continue
    out[key] = fields[i + 1] ?? ''
  }
  return out
}
