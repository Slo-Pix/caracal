// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Control service HTTP server: registers /health, /ready, and the single /v1/agent/invoke endpoint.

package internal

import (
	"context"
	"errors"
	"net/http"
	"os"
	"time"

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
	srv := &Server{
		addr:   addr,
		mux:    http.NewServeMux(),
		log:    log,
		auth:   auth,
		disp:   NewDispatcher(),
		audit:  sink,
		rate:   NewRateLimiter(60, time.Minute),
		stopCh: make(chan struct{}),
	}
	srv.routes()
	return srv, nil
}

func (s *Server) routes() {
	s.mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	s.mux.HandleFunc("/ready", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	s.mux.Handle("/v1/agent/invoke", InvokeHandler(s.auth, s.disp, s.audit, s.rate, s.log))
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
		_ = httpSrv.Shutdown(shutdownCtx)
	}()
	s.log.Info().Str("addr", s.addr).Msg("control surface listening")
	if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
