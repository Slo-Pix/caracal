// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared logging unit tests for service-scoped logger configuration.

package logging

import (
	"testing"

	"github.com/rs/zerolog"
)

func TestNewSetsServiceFieldAndLogLevel(t *testing.T) {
	t.Setenv("LOG_LEVEL", "debug")
	logger := New("gateway")

	if zerolog.GlobalLevel() != zerolog.DebugLevel {
		t.Fatalf("want debug global level, got %s", zerolog.GlobalLevel())
	}
	if logger.GetLevel() != zerolog.TraceLevel {
		t.Fatalf("want logger level trace for inherited global filtering, got %s", logger.GetLevel())
	}
}

func TestNewDefaultsUnknownLevelToInfo(t *testing.T) {
	t.Setenv("LOG_LEVEL", "verbose")
	New("sts")

	if zerolog.GlobalLevel() != zerolog.InfoLevel {
		t.Fatalf("want info global level, got %s", zerolog.GlobalLevel())
	}
}
