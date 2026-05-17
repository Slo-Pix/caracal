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
)

func main() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	log := logging.New("coordinator-relay")
	c, err := internal.New(ctx)
	if err != nil {
		log.Error().Err(err).Msg("startup failed")
		cancel()
		os.Exit(1)
	}
	if err := c.Run(ctx); err != nil && !errors.Is(err, context.Canceled) {
		log.Error().Err(err).Msg("consumer terminated with error")
		cancel()
		os.Exit(1)
	}
}
