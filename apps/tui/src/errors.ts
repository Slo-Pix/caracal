// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Translate raw Error messages from fetch / SDK into actionable hints for the user.

import { scrubTokens as coreScrub } from '@caracalai/engine'

interface AdminApiErrorLike {
  name: string
  status: number
  code: string
  body: unknown
}

function isAdminApiError(err: unknown): err is AdminApiErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'AdminApiError' &&
    typeof (err as { status?: unknown }).status === 'number' &&
    typeof (err as { code?: unknown }).code === 'string'
  )
}

const AUTH_HEADER = /Authorization:\s*\S+/gi

export function scrubTokens(s: string): string {
  return coreScrub(s).replace(AUTH_HEADER, 'Authorization: ***')
}

export function explainError(err: unknown): string {
  return scrubTokens(rawExplain(err))
}

function rawExplain(err: unknown): string {
  if (isAdminApiError(err)) {
    const detail = typeof err.body === 'object' && err.body !== null && 'message' in err.body
      ? String((err.body as { message: unknown }).message)
      : ''
    if (err.status === 401) return `unauthorized — check CARACAL_ADMIN_TOKEN matches the API`
    if (err.status === 403) return `forbidden (${err.code}) — token lacks required scope`
    if (err.status === 404) return `not found — resource may have been deleted`
    return `${err.status} ${err.code}${detail ? ' — ' + detail : ''}`
  }
  if (err instanceof Error) {
    const msg = err.message
    if (/coordinator_url_not_configured/.test(msg)) {
      return 'coordinator URL not set — export CARACAL_COORDINATOR_URL'
    }
    if (/coordinator_token_not_configured/.test(msg)) {
      return 'coordinator token not set — export CARACAL_COORDINATOR_TOKEN'
    }
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(msg)) {
      return `${msg} — is the stack running? try \`caracal up\` and \`caracal status\``
    }
    return msg
  }
  return String(err)
}
