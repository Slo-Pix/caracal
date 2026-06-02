// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// PG advisory-lock leader lease used by exporter, sweeper, and retention rotator
// so multi-replica deployments do not race S3 writes or partition DDL.

package internal

import (
	"context"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

const leaderRefreshInterval = 30 * time.Second

type Leader struct {
	db      leaderStore
	key     int64
	log     zerolog.Logger
	conn    *pgxpool.Conn
	held    atomic.Bool
	stopped atomic.Bool
}

type leaderStore interface {
	AcquireAdvisoryLock(context.Context, int64) (*pgxpool.Conn, bool, error)
	ReleaseAdvisoryLock(context.Context, *pgxpool.Conn, int64) error
}

func newLeader(db leaderStore, key int64, log zerolog.Logger) *Leader {
	return &Leader{db: db, key: key, log: log}
}

// Run continuously attempts to acquire the lock. Once held it remains held
// for the lifetime of the connection. On context cancel the lock is released.
func (l *Leader) Run(ctx context.Context) {
	t := time.NewTicker(leaderRefreshInterval)
	defer t.Stop()
	l.tryAcquire(ctx)
	for {
		select {
		case <-ctx.Done():
			if l.held.Load() && l.conn != nil {
				_ = l.db.ReleaseAdvisoryLock(context.Background(), l.conn, l.key)
				l.conn = nil
			}
			l.held.Store(false)
			l.stopped.Store(true)
			return
		case <-t.C:
			if !l.held.Load() {
				l.tryAcquire(ctx)
			}
		}
	}
}

func (l *Leader) tryAcquire(ctx context.Context) {
	conn, ok, err := l.db.AcquireAdvisoryLock(ctx, l.key)
	if err != nil {
		l.log.Error().Err(err).Int64("key", l.key).Msg("leader: lock attempt failed")
		return
	}
	if ok {
		l.conn = conn
		l.held.Store(true)
		l.log.Info().Int64("key", l.key).Msg("leader acquired")
	}
}

func (l *Leader) Held() bool { return l.held.Load() }
