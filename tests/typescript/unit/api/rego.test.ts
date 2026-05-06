// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for the syntactic Rego validator.

import { describe, it, expect } from 'vitest'
import { parseRego, validatePolicySource, validateAuthzPolicy } from '../../../../apps/api/src/rego.js'

describe('parseRego', () => {
  it('extracts package and rule names', () => {
    const out = parseRego(`package caracal.authz\n\ndefault result := false\nresult { input.x == 1 }`)
    expect(out.error).toBeNull()
    expect(out.packageName).toBe('caracal.authz')
    expect(out.rules.has('result')).toBe(true)
  })

  it('rejects missing package', () => {
    expect(parseRego('result := true').error).toBe('missing_package_declaration')
  })

  it('rejects unbalanced braces', () => {
    expect(parseRego('package p\nresult { input.a == 1').error).toBe('unbalanced_delimiters')
  })

  it('rejects unterminated string', () => {
    expect(parseRego('package p\nx := "oops').error).toBe('unterminated_string')
  })

  it('treats # inside strings as literal', () => {
    const out = parseRego('package p\nx := "value # not comment"\nresult := true')
    expect(out.error).toBeNull()
  })

  it('ignores delimiters inside comments', () => {
    const out = parseRego('package p\n# closing }\nresult := true')
    expect(out.error).toBeNull()
  })
})

describe('validatePolicySource', () => {
  it('passes for any package', () => {
    expect(validatePolicySource('package other\nresult := true')).toBeNull()
  })
})

describe('validateAuthzPolicy', () => {
  it('requires caracal.authz package', () => {
    expect(validateAuthzPolicy('package other\nresult := true')).toBe('must_use_package_caracal_authz')
  })

  it('requires result rule', () => {
    expect(validateAuthzPolicy('package caracal.authz\nallow := true')).toBe('must_define_result_rule')
  })

  it('passes valid policy', () => {
    expect(validateAuthzPolicy('package caracal.authz\nresult := { "allow": true }')).toBeNull()
  })
})
