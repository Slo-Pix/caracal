// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// STS configuration unit tests.

package internal

import (
	"strings"
	"testing"
)

func TestLoadConfigRejectsNonStandardPort(t *testing.T) {
	t.Setenv("PORT", "8081")
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("REDIS_URL", "redis://example")
	t.Setenv("ISSUER_URL", "https://issuer.example")

	_, err := loadConfig()
	if err == nil || !strings.Contains(err.Error(), "8080") {
		t.Fatalf("nonstandard STS port must fail, got %v", err)
	}
}
