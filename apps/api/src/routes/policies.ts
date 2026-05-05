// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Policy CRUD routes: immutable Rego versions with SHA-256 stamping.

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { createHash } from 'crypto'
import { v7 as uuidv7 } from 'uuid'

const PolicyBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  owner_type: z.string().optional(),
  created_by: z.string().default('api'),
  content: z.string().min(1),
  schema_version: z.string().default('2026-03-16'),
})

const VersionBody = z.object({
  content: z.string().min(1),
  created_by: z.string().default('api'),
  schema_version: z.string().default('2026-03-16'),
})

function sha256(s: string) {
  return createHash('sha256').update(s).digest('hex')
}

function validateRego(content: string): string | null {
  if (!/^\s*package\s+[a-zA-Z0-9_.]+/m.test(content)) {
    return 'missing_package_declaration'
  }
  return null
}

export const policiesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/zones/:zoneId/policies', async (req) => {
    const { zoneId } = req.params as { zoneId: string }
    const { rows } = await fastify.db.query(
      `SELECT id, zone_id, name, description, owner_type, created_by, created_at
       FROM policies WHERE zone_id = $1 AND archived_at IS NULL ORDER BY created_at DESC`,
      [zoneId],
    )
    return rows
  })

  fastify.get('/zones/:zoneId/policies/:id', async (req, reply) => {
    const { zoneId, id } = req.params as { zoneId: string; id: string }
    const { rows } = await fastify.db.query(
      `SELECT p.id, p.zone_id, p.name, p.description, p.owner_type, p.created_at,
              json_agg(pv ORDER BY pv.version DESC) AS versions
       FROM policies p
       LEFT JOIN policy_versions pv ON pv.policy_id = p.id
       WHERE p.id = $1 AND p.zone_id = $2
       GROUP BY p.id`,
      [id, zoneId],
    )
    if (!rows[0]) return reply.code(404).send({ error: 'policy_not_found' })
    return rows[0]
  })

  fastify.post('/zones/:zoneId/policies', async (req, reply) => {
    const { zoneId } = req.params as { zoneId: string }
    const body = PolicyBody.parse(req.body)
    const regoErr = validateRego(body.content)
    if (regoErr) return reply.code(422).send({ error: 'invalid_rego', detail: regoErr })
    const policyId = uuidv7()
    const versionId = uuidv7()
    const contentSHA = sha256(body.content)

    const client = await fastify.db.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO policies (id, zone_id, name, description, owner_type, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [policyId, zoneId, body.name, body.description ?? null, body.owner_type ?? 'customer', body.created_by],
      )
      const { rows } = await client.query(
        `INSERT INTO policy_versions (id, policy_id, version, content, content_sha256, schema_version, created_by)
         VALUES ($1, $2, 1, $3, $4, $5, $6)
         RETURNING id, policy_id, version, content_sha256, schema_version, created_at`,
        [versionId, policyId, body.content, contentSHA, body.schema_version, body.created_by],
      )
      await client.query('COMMIT')
      return reply.code(201).send({ id: policyId, zone_id: zoneId, name: body.name, description: body.description ?? null, version: rows[0] })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  })

  fastify.post('/zones/:zoneId/policies/:id/versions', async (req, reply) => {
    const { zoneId, id } = req.params as { zoneId: string; id: string }
    const body = VersionBody.parse(req.body)
    const regoErr = validateRego(body.content)
    if (regoErr) return reply.code(422).send({ error: 'invalid_rego', detail: regoErr })

    const { rows: policyRows } = await fastify.db.query(
      'SELECT id FROM policies WHERE id = $1 AND zone_id = $2',
      [id, zoneId],
    )
    if (!policyRows[0]) return reply.code(404).send({ error: 'policy_not_found' })

    const { rows: maxRows } = await fastify.db.query(
      'SELECT COALESCE(MAX(version), 0) AS max_v FROM policy_versions WHERE policy_id = $1',
      [id],
    )
    const nextVersion = parseInt(maxRows[0].max_v, 10) + 1
    const versionId = uuidv7()
    const contentSHA = sha256(body.content)

    const { rows } = await fastify.db.query(
      `INSERT INTO policy_versions (id, policy_id, version, content, content_sha256, schema_version, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, policy_id, version, content_sha256, schema_version, created_at`,
      [versionId, id, nextVersion, body.content, contentSHA, body.schema_version, body.created_by],
    )
    return reply.code(201).send(rows[0])
  })

  fastify.delete('/zones/:zoneId/policies/:id', async (req, reply) => {
    const { zoneId, id } = req.params as { zoneId: string; id: string }
    await fastify.db.query(
      'UPDATE policies SET archived_at = now() WHERE id = $1 AND zone_id = $2',
      [id, zoneId],
    )
    return reply.code(204).send()
  })
}
