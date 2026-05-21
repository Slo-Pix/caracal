#!/usr/bin/env node
// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Interactive smoke test for the enabled Control API endpoint.

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const DEFAULT_ZONE_URL = 'http://localhost:8080'
const DEFAULT_CONTROL_URL = 'http://localhost:8087'
const CONTROL_AUDIENCE = 'caracal-control'
const CONTROL_SCOPE = 'control:zone:read'

function argValue(name, fallback) {
  const eq = process.argv.find((arg) => arg.startsWith(`${name}=`))
  if (eq) return eq.slice(name.length + 1)
  const index = process.argv.indexOf(name)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]
  return fallback
}

function showHelp() {
  process.stdout.write([
    'Usage: pnpm control:smoke [--zone-url URL] [--control-url URL]',
    '',
    'Prompts for a real zone id, Control key client id, and Control key client secret unless ZONE_ID, APP_CLIENT_ID, and APP_CLIENT_SECRET are set.',
    'Then it mints a Control token and invokes zone list through the Control API.',
    '',
    'Create credentials first from TUI: Control -> create key.',
    '',
  ].join('\n'))
}

async function readJson(res) {
  const text = await res.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function describeBody(body) {
  if (!body) return ''
  return typeof body === 'string' ? body : JSON.stringify(body)
}

async function requireReady(controlUrl) {
  let health
  try {
    health = await fetch(`${controlUrl}/health`)
  } catch (err) {
    throw new Error(`Control API is not reachable at ${controlUrl}: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!health.ok) {
    throw new Error(`Control health check failed with HTTP ${health.status}`)
  }

  const ready = await fetch(`${controlUrl}/ready`)
  if (ready.ok) return
  const body = await readJson(ready)
  if (ready.status === 503) {
    throw new Error(
      `Control runtime is reachable but the endpoint gate is closed (${describeBody(body)}).\n` +
      'The live endpoint is disabled even if a stale TUI screen still says enabled. Restart TUI, open Control, then mount runtime if needed and enable endpoint. If this is an upgraded running container, unmount, mount, and enable once so the gate volume is attached.',
    )
  }
  throw new Error(`Control readiness failed with HTTP ${ready.status}: ${describeBody(body)}`)
}

async function ask(rl, label, fallback = '') {
  const suffix = fallback ? ` [${fallback}]` : ''
  const value = (await rl.question(`${label}${suffix}: `)).trim()
  return value || fallback
}

async function askSecret(label, fallback = '') {
  if (fallback) return fallback
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    const rl = createInterface({ input, output })
    try {
      return (await rl.question(`${label}: `)).trim()
    } finally {
      rl.close()
    }
  }

  return new Promise((resolve, reject) => {
    let value = ''
    const onData = (chunk) => {
      const text = chunk.toString('utf8')
      for (const char of text) {
        if (char === '\u0003') {
          cleanup()
          reject(new Error('Canceled.'))
          return
        }
        if (char === '\r' || char === '\n') {
          output.write('\n')
          cleanup()
          resolve(value.trim())
          return
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1)
          continue
        }
        value += char
      }
    }
    const cleanup = () => {
      input.off('data', onData)
      input.setRawMode(false)
      input.pause()
    }
    output.write(`${label}: `)
    input.setRawMode(true)
    input.resume()
    input.on('data', onData)
  })
}

async function mintToken(zoneUrl, zoneId, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    zone_id: zoneId,
    application_id: clientId,
    client_secret: clientSecret,
    resource: CONTROL_AUDIENCE,
    scope: CONTROL_SCOPE,
  })
  const res = await fetch(`${zoneUrl}/oauth/2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await readJson(res)
  if (!res.ok) {
    throw new Error(`Token mint failed with HTTP ${res.status}: ${describeBody(data)}`)
  }
  if (!data || typeof data !== 'object' || typeof data.access_token !== 'string') {
    throw new Error(`Token response did not include access_token: ${describeBody(data)}`)
  }
  return data.access_token
}

async function invokeControl(controlUrl, token) {
  const res = await fetch(`${controlUrl}/v1/control/invoke`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ command: 'zone', subcommand: 'list' }),
  })
  const data = await readJson(res)
  if (!res.ok) {
    throw new Error(`Control invoke failed with HTTP ${res.status}: ${describeBody(data)}`)
  }
  return data
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp()
    return
  }

  const zoneUrl = argValue('--zone-url', process.env.ZONE_URL ?? DEFAULT_ZONE_URL).replace(/\/+$/, '')
  const controlUrl = argValue('--control-url', process.env.CONTROL_URL ?? DEFAULT_CONTROL_URL).replace(/\/+$/, '')

  process.stdout.write(`Control API smoke test\nzone URL: ${zoneUrl}\ncontrol URL: ${controlUrl}\n\n`)
  await requireReady(controlUrl)
  process.stdout.write('Control endpoint gate is open.\n\n')

  let zoneId = process.env.ZONE_ID ?? ''
  let clientId = process.env.APP_CLIENT_ID ?? ''
  if (!zoneId || !clientId) {
    const rl = createInterface({ input, output })
    try {
      zoneId = await ask(rl, 'Zone ID', zoneId)
      clientId = await ask(rl, 'Control key client_id', clientId)
    } finally {
      rl.close()
    }
  }
  const clientSecret = process.env.APP_CLIENT_SECRET ?? await askSecret('Control key client_secret shown once after create')

  if (!zoneId || !clientId || !clientSecret) {
    throw new Error('Zone ID, client_id, and client_secret are required.')
  }

  const token = await mintToken(zoneUrl, zoneId, clientId, clientSecret)
  process.stdout.write('Token minted.\n')
  const result = await invokeControl(controlUrl, token)
  process.stdout.write('Control invoke succeeded.\n')
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
}

main().catch((err) => {
  process.stderr.write(`control smoke: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
