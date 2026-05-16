// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Error type raised for non-2xx admin API responses.

import { CaracalError, redact, type JsonValue } from '@caracalai/core'

export class AdminApiError extends CaracalError {
  readonly status: number
  readonly body: JsonValue

  constructor(status: number, code: string, body: JsonValue, message?: string) {
    const safeBody = redact(body) as JsonValue
    super(code, message ?? `${code} (HTTP ${status})`, { details: { status, body: safeBody } })
    this.name = 'AdminApiError'
    this.status = status
    this.body = safeBody
  }
}
