// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// STS service entry point.

package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/garudex-labs/caracal/packages/core/go/config"
	"github.com/garudex-labs/caracal/packages/core/go/logging"
	"github.com/garudex-labs/caracal/packages/core/go/telemetry"
	"github.com/garudex-labs/caracal/sts/internal"
)

type runner interface {
	Run(context.Context) error
}

var (
	assertSafe     = config.AssertPublishedSafe
	notifyContext  = signal.NotifyContext
	setupTelemetry = telemetry.Setup
	newRunner      = func(ctx context.Context) (runner, error) { return internal.New(ctx) }
	exitProcess    = os.Exit
)

func main() {
	if code := run(context.Background()); code != 0 {
		exitProcess(code)
	}
}

func run(parent context.Context) int {
	assertSafe()
	log := logging.New("sts")
	ctx, cancel := notifyContext(parent, os.Interrupt, syscall.SIGTERM)
	defer cancel()
	shutdownTelemetry, err := setupTelemetry(ctx, "caracal-sts")
	if err != nil {
		log.Error().Err(err).Msg("telemetry init failed")
		return 1
	}
	defer func() { _ = shutdownTelemetry(context.Background()) }()

	srv, err := newRunner(ctx)
	if err != nil {
		log.Error().Err(err).Msg("init failed")
		cancel()
		return 1
	}

	if err := srv.Run(ctx); err != nil {
		log.Error().Err(err).Msg("run failed")
		cancel()
		return 1
	}
	return 0
}
