// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Redis client and stream helpers for the agent coordinator.

import { Redis } from 'ioredis'

let redisClient: Redis | undefined

export function getRedis(): Redis {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) throw new Error('required env var missing: REDIS_URL')
  redisClient ??= new Redis(redisUrl)
  return redisClient
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return Reflect.get(getRedis(), prop)
  },
})

export async function publishLifecycle(
  event: string,
  zoneId: string,
  sessionId: string,
  parentId: string | null,
) {
  await getRedis().xadd('caracal.agents.lifecycle', '*',
    'event', event,
    'zone_id', zoneId,
    'session_id', sessionId,
    'parent_id', parentId ?? '',
  )
}

export async function publishSessionRevocation(zoneId: string, sessionSid: string) {
  await getRedis().xadd('caracal.sessions.revoke', '*',
    'zone_id', zoneId,
    'session_id', sessionSid,
  )
}
