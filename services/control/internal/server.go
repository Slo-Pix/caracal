// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control service HTTP server: registers /health, /ready, and the single /v1/control/invoke endpoint.

package internal

import (
	"context"
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/garudex-labs/caracal/core/config"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

type Server struct {
	addr   string
	mux    *http.ServeMux
	log    zerolog.Logger
	auth   *Authenticator
	disp   *Dispatcher
	audit  EventSink
	rate   *RateLimiter
	replay Replay
	stopCh chan struct{}
}

func New(ctx context.Context, log zerolog.Logger) (*Server, error) {
	addr := os.Getenv("CONTROL_ADDR")
	if addr == "" {
		addr = ":8087"
	}
	auth, err := NewAuthenticator(ctx)
	if err != nil {
		return nil, err
	}
	sink, err := NewEventSink(ctx, log)
	if err != nil {
		return nil, err
	}
	replay, err := buildReplay(log)
	if err != nil {
		return nil, err
	}
	disp := NewDispatcher()
	if config.Mode() == "runtime" && !disp.HasUpstreams() {
		return nil, errors.New("control upstreams not configured")
	}
	srv := &Server{
		addr:   addr,
		mux:    http.NewServeMux(),
		log:    log,
		auth:   auth,
		disp:   disp,
		audit:  sink,
		rate:   NewRateLimiter(60, time.Minute),
		replay: replay,
		stopCh: make(chan struct{}),
	}
	srv.routes()
	return srv, nil
}

func buildReplay(log zerolog.Logger) (Replay, error) {
	url := os.Getenv("CONTROL_REDIS_URL")
	if url == "" {
		if config.Mode() == "runtime" {
			return nil, errors.New("CONTROL_REDIS_URL is required when CARACAL_MODE=runtime")
		}
		log.Info().Msg("replay cache: in-memory (single replica)")
		return NewReplayCache(time.Hour), nil
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	log.Info().Str("addr", opt.Addr).Msg("replay cache: redis (multi-replica safe)")
	return NewRedisReplay(redis.NewClient(opt), time.Hour), nil
}

func (s *Server) routes() {
	s.mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	s.mux.HandleFunc("/ready", s.handleReady)
	s.mux.Handle("/v1/control/invoke", InvokeHandler(s.auth, s.disp, s.audit, s.rate, s.replay, s.log))
}

func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	if !s.disp.HasUpstreams() {
		http.Error(w, "control upstreams unavailable", http.StatusServiceUnavailable)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.replay.Ping(ctx); err != nil {
		s.log.Warn().Err(err).Msg("readiness: replay backing store unavailable")
		http.Error(w, "replay store unavailable", http.StatusServiceUnavailable)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) Run(ctx context.Context) error {
	httpSrv := &http.Server{
		Addr:              s.addr,
		Handler:           s.mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpSrv.Shutdown(shutdownCtx); err != nil {
			s.log.Error().Err(err).Msg("graceful shutdown failed; forcing close")
			_ = httpSrv.Close()
		}
	}()
	s.log.Info().Str("addr", s.addr).Msg("control surface listening")
	if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
