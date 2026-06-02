// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Monthly partition pre-creation and retention enforcement for audit_events.

package internal

import (
	"context"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
)

const retentionInterval = 6 * time.Hour

type Retention struct {
	db            retentionStore
	leader        *Leader
	log           zerolog.Logger
	retentionDays int
	createdTotal  atomic.Int64
	droppedTotal  atomic.Int64
}

type retentionStore interface {
	EnsurePartition(context.Context, time.Time) error
	DropPartitionsBefore(context.Context, time.Time) ([]string, error)
}

func newRetention(db retentionStore, leader *Leader, days int, log zerolog.Logger) *Retention {
	return &Retention{db: db, leader: leader, log: log, retentionDays: days}
}

func (r *Retention) Run(ctx context.Context) {
	r.tick(ctx)
	t := time.NewTicker(retentionInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			r.tick(ctx)
		}
	}
}

func (r *Retention) tick(ctx context.Context) {
	if r.leader != nil && !r.leader.Held() {
		return
	}
	now := time.Now().UTC()
	for m := 0; m <= 3; m++ {
		target := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, m, 0)
		if err := r.db.EnsurePartition(ctx, target); err != nil {
			r.log.Error().Err(err).Time("month", target).Msg("retention: ensure partition")
			return
		}
		r.createdTotal.Add(1)
	}
	cutoff := now.AddDate(0, 0, -r.retentionDays)
	dropped, err := r.db.DropPartitionsBefore(ctx, cutoff)
	if err != nil {
		r.log.Error().Err(err).Msg("retention: drop partitions")
		return
	}
	if len(dropped) > 0 {
		r.droppedTotal.Add(int64(len(dropped)))
		r.log.Info().Strs("dropped", dropped).Time("cutoff", cutoff).Msg("retention: partitions dropped")
	}
}
