// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared configuration loader for Caracal Go services.

package config

import (
	"os"
	"strconv"
	"strings"
)

// Base holds env-driven configuration common to every Go service.
type Base struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	LogLevel    string
	Mode        string
}

// Load reads Base from environment variables, collecting all missing required values
// into a single error rather than panicking on the first miss.
func Load() Base {
	missing := MissingRequired("PORT", "DATABASE_URL", "REDIS_URL")
	if len(missing) > 0 {
		panic("required env vars missing: " + strings.Join(missing, ", "))
	}
	return Base{
		Port:        os.Getenv("PORT"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		RedisURL:    os.Getenv("REDIS_URL"),
		LogLevel:    Getenv("LOG_LEVEL", "info"),
		Mode:        Mode(),
	}
}

// Mode returns the explicit Caracal deployment mode (dev or runtime). Defaults to runtime
// when unset so production safety wins on misconfiguration.
func Mode() string {
	m := strings.ToLower(strings.TrimSpace(os.Getenv("CARACAL_MODE")))
	switch m {
	case "dev", "runtime":
		return m
	case "":
		return "runtime"
	default:
		panic("CARACAL_MODE must be 'dev' or 'runtime' (got '" + m + "')")
	}
}

// AssertRuntimeSafe panics if any developer-only escape hatch is set while CARACAL_MODE=runtime.
// Call early in service startup; cheap and idempotent.
func AssertRuntimeSafe() {
	if Mode() != "runtime" {
		return
	}
	forbidden := []string{"INSECURE_STS", "INSECURE_HTTP"}
	var set []string
	for _, k := range forbidden {
		if v := strings.ToLower(os.Getenv(k)); v == "true" || v == "1" || v == "yes" {
			set = append(set, k)
		}
	}
	if len(set) > 0 {
		panic("CARACAL_MODE=runtime forbids: " + strings.Join(set, ", "))
	}
}

// MissingRequired returns the names of any required env vars that are unset or empty.
// Use this at startup to surface every missing var in one structured error.
func MissingRequired(keys ...string) []string {
	var missing []string
	for _, k := range keys {
		if os.Getenv(k) == "" {
			missing = append(missing, k)
		}
	}
	return missing
}

// IsRuntime reports whether the service runs under CARACAL_MODE=runtime.
func (b Base) IsRuntime() bool { return b.Mode == "runtime" }

// MustGetenv returns the value of key or panics if it is unset or empty.
func MustGetenv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("required env var missing: " + key)
	}
	return v
}

// Getenv returns the value of key or fallback when unset or empty.
func Getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// PositiveIntEnv returns a positive integer env var or fallback when unset or invalid.
func PositiveIntEnv(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

// PositiveInt64Env returns a positive int64 env var or fallback when unset or invalid.
func PositiveInt64Env(key string, fallback int64) int64 {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
