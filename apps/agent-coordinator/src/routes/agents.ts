// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Agent lifecycle routes: spawn, topology, suspend/resume, cascade terminate.

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { v7 as uuidv7 } from 'uuid'
import type { Pool } from 'pg'
import { publishLifecycle, publishSessionRevocation } from '../redis.js'

const MAX_DEPTH = 10
const MAX_CHILDREN = 10
const MAX_TOTAL = 50
const DEFAULT_TTL = 3600

const SpawnBody = z.object({
  application_id: z.string().min(1),
  session_sid: z.string().min(1),
  parent_id: z.string().nullable().default(null),
  capabilities: z.array(z.string()).default([]),
  ttl_seconds: z.number().int().min(1).max(86400).default(DEFAULT_TTL),
})

export const agentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/zones/:zoneId/agents', async (req, reply) => {
    const { zoneId } = req.params as { zoneId: string }
    const body = SpawnBody.parse(req.body)
    const id = uuidv7()
    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')
      const { rows: refs } = await client.query(
        `SELECT
           EXISTS (
             SELECT 1 FROM applications
             WHERE id = $2 AND zone_id = $1 AND archived_at IS NULL
               AND (expires_at IS NULL OR expires_at > now())
           ) AS application_exists,
           EXISTS (
             SELECT 1 FROM sessions
             WHERE id = $3 AND zone_id = $1 AND status = 'active' AND expires_at > now()
           ) AS session_exists`,
        [zoneId, body.application_id, body.session_sid],
      )
      if (!refs[0]?.application_exists) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'application_not_found' })
      }
      if (!refs[0].session_exists) {
        await client.query('ROLLBACK')
        return reply.code(404).send({ error: 'session_not_found' })
      }
      const { rows: cnt } = await client.query(
        `SELECT COUNT(*) AS n FROM agent_sessions WHERE zone_id = $1 AND status = 'active'`,
        [zoneId],
      )
      if (parseInt(cnt[0].n, 10) >= MAX_TOTAL) {
        await client.query('ROLLBACK')
        return reply.code(429).send({ error: 'agent_limit_exceeded' })
      }

      let depth = 0
      if (body.parent_id) {
        const { rows: parent } = await client.query(
          `SELECT depth, child_count, max_children FROM agent_sessions
           WHERE id = $1 AND zone_id = $2 AND status = 'active'
           FOR UPDATE`,
          [body.parent_id, zoneId],
        )
        if (!parent[0]) {
          await client.query('ROLLBACK')
          return reply.code(404).send({ error: 'parent_not_found' })
        }
        if (parent[0].child_count >= parent[0].max_children) {
          await client.query('ROLLBACK')
          return reply.code(429).send({ error: 'agent_children_limit_exceeded' })
        }
        depth = parent[0].depth + 1
        if (depth > MAX_DEPTH) {
          await client.query('ROLLBACK')
          return reply.code(429).send({ error: 'agent_depth_limit_exceeded' })
        }
      }
      const { rows } = await client.query(
        `INSERT INTO agent_sessions
         (id, zone_id, application_id, parent_id, session_sid, depth, capabilities, max_children, ttl_seconds)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, zone_id, application_id, parent_id, session_sid, status, depth, spawned_at`,
        [id, zoneId, body.application_id, body.parent_id, body.session_sid,
          depth, body.capabilities, MAX_CHILDREN, body.ttl_seconds],
      )
      if (body.parent_id) {
        await client.query(
          `INSERT INTO agent_topology (parent_id, child_id) VALUES ($1,$2)`,
          [body.parent_id, id],
        )
        await client.query(
          `UPDATE agent_sessions SET child_count = child_count + 1 WHERE id = $1`,
          [body.parent_id],
        )
      }
      await client.query('COMMIT')
      await publishLifecycle('spawn', zoneId, id, body.parent_id)
      return reply.code(201).send(rows[0])
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  fastify.get('/zones/:zoneId/agents', async (req) => {
    const { zoneId } = req.params as { zoneId: string }
    const { rows } = await fastify.db.query(
      `SELECT id, zone_id, application_id, parent_id, session_sid, status, depth, spawned_at, terminated_at
       FROM agent_sessions WHERE zone_id = $1 ORDER BY spawned_at DESC`,
      [zoneId],
    )
    return rows
  })

  fastify.get('/zones/:zoneId/agents/:id', async (req, reply) => {
    const { zoneId, id } = req.params as { zoneId: string; id: string }
    const { rows } = await fastify.db.query(
      `SELECT id, zone_id, application_id, parent_id, session_sid, status, depth, spawned_at, terminated_at
       FROM agent_sessions WHERE id = $1 AND zone_id = $2`,
      [id, zoneId],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'agent_not_found' })
    return rows[0]
  })

  fastify.get('/zones/:zoneId/agents/:id/children', async (req) => {
    const { zoneId, id } = req.params as { zoneId: string; id: string }
    const { rows } = await fastify.db.query(
      `SELECT s.id, s.zone_id, s.application_id, s.parent_id, s.session_sid, s.status, s.depth, s.spawned_at
       FROM agent_sessions s
       JOIN agent_topology t ON t.child_id = s.id
       WHERE t.parent_id = $1 AND s.zone_id = $2
       ORDER BY s.spawned_at`,
      [id, zoneId],
    )
    return rows
  })

  fastify.patch('/zones/:zoneId/agents/:id/suspend', async (req, reply) => {
    const { zoneId, id } = req.params as { zoneId: string; id: string }
    const { rows } = await fastify.db.query(
      `UPDATE agent_sessions SET status = 'suspended'
       WHERE id = $1 AND zone_id = $2 AND status = 'active'
       RETURNING id`,
      [id, zoneId],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'agent_not_found_or_not_active' })
    await publishLifecycle('suspend', zoneId, id, null)
    return { suspended: true }
  })

  fastify.patch('/zones/:zoneId/agents/:id/resume', async (req, reply) => {
    const { zoneId, id } = req.params as { zoneId: string; id: string }
    const { rows } = await fastify.db.query(
      `UPDATE agent_sessions SET status = 'active', last_active_at = now()
       WHERE id = $1 AND zone_id = $2 AND status = 'suspended'
       RETURNING id`,
      [id, zoneId],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'agent_not_found_or_not_suspended' })
    await publishLifecycle('resume', zoneId, id, null)
    return { resumed: true }
  })

  fastify.delete('/zones/:zoneId/agents/:id', async (req, reply) => {
    const { zoneId, id } = req.params as { zoneId: string; id: string }
    await cascadeTerminate(fastify.db, zoneId, id)
    return reply.code(204).send()
  })
}

async function cascadeTerminate(db: Pool, zoneId: string, id: string): Promise<void> {
  const { rows: descendants } = await db.query(
    `WITH RECURSIVE tree AS (
       SELECT id, session_sid FROM agent_sessions WHERE id = $1 AND zone_id = $2
       UNION ALL
       SELECT s.id, s.session_sid
       FROM agent_sessions s
       JOIN tree t ON s.parent_id = t.id
       WHERE s.zone_id = $2
     )
     SELECT id, session_sid FROM tree`,
    [id, zoneId],
  )
  if (descendants.length === 0) return

  const ids = descendants.map((d: { id: string }) => d.id)
  await db.query(
    `UPDATE agent_sessions SET status = 'terminated', terminated_at = now()
     WHERE id = ANY($1::text[])`,
    [ids],
  )
  for (const d of descendants) {
    await withRetry(() => publishSessionRevocation(zoneId, d.session_sid))
    await withRetry(() => publishLifecycle('terminate', zoneId, d.id, null))
  }
}

async function withRetry(fn: () => Promise<void>, maxAttempts = 3, baseMs = 100): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn()
      return
    } catch (err) {
      if (attempt === maxAttempts) throw err
      await new Promise(r => setTimeout(r, baseMs * 2 ** (attempt - 1)))
    }
  }
}
