// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Redis client lifecycle for the coordinator outbox publisher.

import { Redis } from 'ioredis'
import { cfg, type Cfg } from './config.js'

export function buildRedis(config: Cfg = cfg): Redis {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  })
}

export async function redisMinuteBucket(redis: Redis): Promise<number> {
  if (typeof redis.time !== 'function') return Math.floor(Date.now() / 60_000)
  const [seconds] = await redis.time()
  return Math.floor(Number(seconds) / 60)
}

export async function closeRedis(client: Redis): Promise<void> {
  try {
    await client.quit()
  } catch {
    client.disconnect()
  }
}
