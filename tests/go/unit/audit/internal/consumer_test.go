// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Audit consumer recovery and health tests.

package internal

import (
	"testing"

	"github.com/rs/zerolog"
)

func TestConsumerStartsUnhealthyUntilStreamReady(t *testing.T) {
	consumer := newConsumer(nil, nil, zerolog.Nop(), Config{})
	if consumer.Healthy() {
		t.Fatal("consumer must remain unhealthy until stream initialization succeeds")
	}
}
