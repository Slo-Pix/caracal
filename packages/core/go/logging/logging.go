// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Zerolog-backed structured JSON logger for Caracal Go services.

package logging

import (
	"os"
	"runtime/debug"
	"strings"
	"sync"

	"github.com/rs/zerolog"
)

var (
	hostnameOnce sync.Once
	hostname     string
	versionOnce  sync.Once
	version      string
)

func host() string {
	hostnameOnce.Do(func() {
		h, err := os.Hostname()
		if err != nil || h == "" {
			h = "unknown"
		}
		hostname = h
	})
	return hostname
}

func ver() string {
	versionOnce.Do(func() {
		if v := os.Getenv("CARACAL_VERSION"); v != "" {
			version = v
			return
		}
		if info, ok := debug.ReadBuildInfo(); ok && info.Main.Version != "" && info.Main.Version != "(devel)" {
			version = info.Main.Version
			return
		}
		version = "dev"
	})
	return version
}

func env() string {
	if e := os.Getenv("CARACAL_ENV"); e != "" {
		return e
	}
	if e := os.Getenv("APP_ENV"); e != "" {
		return e
	}
	return "development"
}

// New returns a zerolog.Logger scoped to the named service with standard
// process-level fields (service, hostname, pid, version, env) bound once.
// Log level is read from the LOG_LEVEL environment variable (default: info).
func New(service string) zerolog.Logger {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnixMs
	zerolog.MessageFieldName = "msg"
	zerolog.LevelFieldName = "level"
	zerolog.TimestampFieldName = "time"
	zerolog.ErrorStackMarshaler = nil
	return zerolog.New(os.Stderr).Level(envLevel()).With().
		Timestamp().
		Str("service", service).
		Str("hostname", host()).
		Int("pid", os.Getpid()).
		Str("version", ver()).
		Str("env", env()).
		Logger()
}

// SetGlobalLevel updates zerolog's process-wide log level. Call once during service init.
func SetGlobalLevel() {
	zerolog.SetGlobalLevel(envLevel())
}

func envLevel() zerolog.Level {
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		return zerolog.DebugLevel
	case "warn":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	}
	return zerolog.InfoLevel
}

