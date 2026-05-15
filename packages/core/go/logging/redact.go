// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Centralized secret-key and value-pattern redaction shared across all logging surfaces.

package logging

import (
	"regexp"
	"strings"
)

// SecretKeys are the field names whose values must never appear in dev logs.
// Mirror this list in the TS and Python core packages.
var SecretKeys = []string{
	"password",
	"secret",
	"token",
	"access_token",
	"refresh_token",
	"id_token",
	"api_key",
	"client_secret",
	"private_key",
	"session",
	"assertion",
	"authorization",
	"cookie",
	"set_cookie",
	"hmac",
	"signature",
}

// IsSecretKey reports whether the given field name should be redacted.
// Matching is case-insensitive and substring-based so that variants like
// "ApiKey", "X-Auth-Token", and "user_password" are caught.
func IsSecretKey(name string) bool {
	lower := strings.ToLower(name)
	for _, k := range SecretKeys {
		if strings.Contains(lower, k) {
			return true
		}
	}
	return false
}

// RedactValue returns the canonical replacement for redacted values.
const RedactValue = "***"

var (
	bearerPattern = regexp.MustCompile(`(?i)bearer\s+[A-Za-z0-9._\-+/=]{8,}`)
	jwtPattern    = regexp.MustCompile(`eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}`)
)

// RedactString scrubs Bearer tokens and JWT-shaped substrings from a string.
// Cheap on the common path (no allocation when no match).
func RedactString(s string) string {
	if len(s) < 16 {
		return s
	}
	s = bearerPattern.ReplaceAllString(s, "Bearer "+RedactValue)
	s = jwtPattern.ReplaceAllString(s, RedactValue)
	return s
}

// RedactMap returns a copy of m with values for secret keys replaced and
// string values scrubbed of token-like patterns.
func RedactMap(m map[string]any) map[string]any {
	if m == nil {
		return nil
	}
	out := make(map[string]any, len(m))
	for k, v := range m {
		if IsSecretKey(k) {
			out[k] = RedactValue
			continue
		}
		out[k] = redactValue(v)
	}
	return out
}

func redactValue(v any) any {
	switch x := v.(type) {
	case string:
		return RedactString(x)
	case map[string]any:
		return RedactMap(x)
	case []any:
		out := make([]any, len(x))
		for i, e := range x {
			out[i] = redactValue(e)
		}
		return out
	default:
		return v
	}
}

