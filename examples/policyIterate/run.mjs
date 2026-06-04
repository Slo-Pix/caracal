/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

CLI entry that wires the Caracal Admin API into the policy iterate loop for a denied request.
*/

import { iterate } from './iterate.mjs'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`missing required env: ${name}`)
    process.exit(2)
  }
  return value
}

function adminTransport(apiUrl, adminToken, zoneId) {
  const base = apiUrl.replace(/\/$/, '')
  const headers = { authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' }
  return {
    async explain(requestId) {
      const res = await fetch(`${base}/v1/zones/${zoneId}/audit/by-request/${encodeURIComponent(requestId)}/explain`, { headers })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`explain failed: ${res.status}`)
      return res.json()
    },
    async simulate(policySetId, versionId, input) {
      const res = await fetch(`${base}/v1/zones/${zoneId}/policy-sets/${encodeURIComponent(policySetId)}/simulate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ version_id: versionId, input }),
      })
      if (!res.ok) throw new Error(`simulate failed: ${res.status}`)
      return res.json()
    },
  }
}

async function main() {
  const apiUrl = requireEnv('CARACAL_API_URL')
  const adminToken = requireEnv('CARACAL_ADMIN_TOKEN')
  const zoneId = requireEnv('CARACAL_ZONE_ID')
  const requestId = requireEnv('PREFLIGHT_REQUEST_ID')
  const policySetId = requireEnv('CANDIDATE_POLICY_SET_ID')
  const candidateVersionId = requireEnv('CANDIDATE_POLICY_SET_VERSION_ID')

  const transport = adminTransport(apiUrl, adminToken, zoneId)
  const report = await iterate({ transport, requestId, policySetId, candidateVersionId })

  console.log(JSON.stringify(report, null, 2))
  if (!report.reproduced) {
    console.error('request was not denied; nothing to iterate on')
    process.exit(1)
  }
  process.exit(report.fixed ? 0 : 1)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(2)
})
