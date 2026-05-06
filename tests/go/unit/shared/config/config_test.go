// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared config unit tests for environment-driven defaults and required values.

package config

import "testing"

func TestGetenvUsesFallbackForMissingOrEmptyValue(t *testing.T) {
	t.Setenv("CARACAL_TEST_EMPTY", "")
	if got := Getenv("CARACAL_TEST_MISSING", "fallback"); got != "fallback" {
		t.Fatalf("want fallback for missing env, got %q", got)
	}
	if got := Getenv("CARACAL_TEST_EMPTY", "fallback"); got != "fallback" {
		t.Fatalf("want fallback for empty env, got %q", got)
	}
}

func TestMustGetenvPanicsWhenMissing(t *testing.T) {
	defer func() {
		if recovered := recover(); recovered == nil {
			t.Fatal("expected panic for missing env var")
		}
	}()
	MustGetenv("CARACAL_TEST_REQUIRED")
}

func TestLoadReadsBaseConfig(t *testing.T) {
	t.Setenv("PORT", "8080")
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("REDIS_URL", "redis://example")
	t.Setenv("LOG_LEVEL", "debug")

	cfg := Load()
	if cfg.Port != "8080" || cfg.DatabaseURL != "postgres://example" || cfg.RedisURL != "redis://example" || cfg.LogLevel != "debug" {
		t.Fatalf("unexpected config: %#v", cfg)
	}
}
