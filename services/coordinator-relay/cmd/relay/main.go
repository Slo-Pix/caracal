// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Coordinator relay entry point.

package main

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"

	"github.com/garudex-labs/caracal/coordinator-relay/internal"
	"github.com/garudex-labs/caracal/packages/core/go/logging"
	"github.com/garudex-labs/caracal/packages/core/go/telemetry"
)

type runner interface {
	Run(context.Context) error
}

var (
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
	ctx, cancel := notifyContext(parent, os.Interrupt, syscall.SIGTERM)
	defer cancel()

	log := logging.New("coordinator-relay")
	shutdownTelemetry, err := setupTelemetry(ctx, "caracal-coordinator-relay")
	if err != nil {
		log.Error().Err(err).Msg("telemetry init failed")
		return 1
	}
	defer func() { _ = shutdownTelemetry(context.Background()) }()

	c, err := newRunner(ctx)
	if err != nil {
		log.Error().Err(err).Msg("startup failed")
		cancel()
		return 1
	}
	if err := c.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Error().Err(err).Msg("consumer terminated with error")
		cancel()
		return 1
	}
	return 0
}
