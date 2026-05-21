// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Audit service entry point.

package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/garudex-labs/caracal/audit/internal"
	"github.com/garudex-labs/caracal/packages/core/go/config"
	"github.com/garudex-labs/caracal/packages/core/go/logging"
	"github.com/garudex-labs/caracal/packages/core/go/telemetry"
)

func main() {
	config.AssertPublishedSafe()
	log := logging.New("audit")
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	shutdownTelemetry, err := telemetry.Setup(ctx, "caracal-audit")
	if err != nil {
		log.Error().Err(err).Msg("telemetry init failed")
		os.Exit(1)
	}
	defer func() { _ = shutdownTelemetry(context.Background()) }()

	srv, err := internal.New(ctx)
	if err != nil {
		log.Error().Err(err).Msg("init failed")
		cancel()
		os.Exit(1)
	}
	if err := srv.Run(ctx); err != nil {
		log.Error().Err(err).Msg("run failed")
		cancel()
		os.Exit(1)
	}
}
