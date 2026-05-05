// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tamper-detection sweep: recomputes SHA-256 over stored event fields and flags mismatches.

package internal

import (
	"context"
	"time"

	"github.com/rs/zerolog"
)

type TamperSweeper struct {
	db  *PGWriter
	log zerolog.Logger
}

func NewTamperSweeper(db *PGWriter, log zerolog.Logger) *TamperSweeper {
	return &TamperSweeper{db: db, log: log}
}

func (s *TamperSweeper) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.sweep(ctx)
		}
	}
}

func (s *TamperSweeper) sweep(ctx context.Context) {
	until := time.Now().UTC()
	since := until.Add(-2 * time.Hour)

	events, err := s.db.QuerySince(ctx, since, until)
	if err != nil {
		s.log.Error().Err(err).Msg("tamper sweep query")
		return
	}

	mismatches := 0
	for _, ev := range events {
		storedHash, err := s.db.QueryContentHash(ctx, ev.ID, ev.OccurredAt)
		if err != nil || storedHash == "" {
			continue
		}
		if contentHash(ev) != storedHash {
			mismatches++
			s.log.Warn().
				Str("event_id", ev.ID).
				Str("zone_id", ev.ZoneID).
				Msg("tamper detected: content hash mismatch")
		}
	}
	s.log.Info().
		Int("checked", len(events)).
		Int("mismatches", mismatches).
		Msg("tamper sweep complete")
}
