// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Audit service: bootstrap, consumer/exporter/sweeper lifecycle, and health/metrics endpoints.

package internal

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

type Server struct {
	cfg          Config
	consumer     *Consumer
	exporter     *ParquetExporter
	sweeper      *TamperSweeper
	log          zerolog.Logger
	inserts      atomic.Int64
	exportEvents atomic.Int64
	exportErrors atomic.Int64
	exportDurMs  atomic.Int64 // last export duration in milliseconds
	consumerLag  atomic.Int64 // pending message count in the Redis stream consumer group
}

func New(ctx context.Context) (*Server, error) {
	cfg := loadConfig()
	log := zerolog.New(os.Stderr).With().Timestamp().Logger()

	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, err
	}
	r := redis.NewClient(opts)

	pg := &PGWriter{db: db}
	exp, err := newParquetExporter(pg, cfg, log)
	if err != nil {
		return nil, err
	}
	s := &Server{
		cfg:      cfg,
		consumer: &Consumer{db: pg, redis: r, log: log},
		exporter: exp,
		sweeper:  NewTamperSweeper(pg, log),
		log:      log,
	}
	pg.onInsert = func() { s.inserts.Add(1) }
	exp.onExport = func(events int64, durMs int64, failed bool) {
		s.exportEvents.Add(events)
		s.exportDurMs.Store(durMs)
		if failed {
			s.exportErrors.Add(1)
		}
	}
	return s, nil
}

func (s *Server) Run(ctx context.Context) {
	go s.consumer.Run(ctx)
	go s.exporter.Run(ctx)
	go s.sweeper.Run(ctx)
	go s.pollConsumerLag(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"inserts_total":       s.inserts.Load(),
			"export_events_total": s.exportEvents.Load(),
			"export_errors_total": s.exportErrors.Load(),
			"export_duration_ms":  s.exportDurMs.Load(),
			"consumer_lag":        s.consumerLag.Load(),
		})
	})

	srv := &http.Server{Addr: ":" + s.cfg.Port, Handler: mux}
	go srv.ListenAndServe()
	<-ctx.Done()
	srv.Close()
}

// pollConsumerLag reads the pending message count for the audit consumer group every 30s.
func (s *Server) pollConsumerLag(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			info, err := s.consumer.redis.XPending(ctx, auditStream, consumerGroup).Result()
			if err == nil {
				s.consumerLag.Store(info.Count)
			}
		case <-ctx.Done():
			return
		}
	}
}

