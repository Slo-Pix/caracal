// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Zerolog-backed structured JSON logger for Caracal Go services.

package logging

import (
	"os"
	"strings"

	"github.com/rs/zerolog"
)

// New returns a zerolog.Logger scoped to the named service.
// Log level is read from the LOG_LEVEL environment variable (default: info).
func New(service string) zerolog.Logger {
	level := zerolog.InfoLevel
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		level = zerolog.DebugLevel
	case "warn":
		level = zerolog.WarnLevel
	case "error":
		level = zerolog.ErrorLevel
	}
	zerolog.SetGlobalLevel(level)
	return zerolog.New(os.Stderr).With().
		Timestamp().
		Str("service", service).
		Logger()
}
