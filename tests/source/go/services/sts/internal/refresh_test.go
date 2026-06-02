// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for provider TTL capping and jittered retry backoff.

package internal

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	sharederr "github.com/garudex-labs/caracal/packages/core/go/errors"
)

func TestCapGrantTTLBounded(t *testing.T) {
	cases := []struct {
		name     string
		provider int
		max      int
		want     time.Duration
	}{
		{"caps_oversized_provider_ttl", 86400, 3600, 3600 * time.Second},
		{"keeps_provider_ttl_under_max", 1800, 3600, 1800 * time.Second},
		{"falls_back_to_max_on_zero", 0, 3600, 3600 * time.Second},
		{"falls_back_to_max_on_negative", -10, 600, 600 * time.Second},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := capGrantTTL(tc.provider, tc.max)
			if got != tc.want {
				t.Errorf("capGrantTTL(%d,%d)=%v want %v", tc.provider, tc.max, got, tc.want)
			}
		})
	}
}

func TestJitteredBackoffWithinBounds(t *testing.T) {
	base := 25 * time.Millisecond
	for attempt := 0; attempt < 5; attempt++ {
		min := base * time.Duration(attempt+1)
		max := min + base
		for i := 0; i < 100; i++ {
			d := jitteredBackoff(base, attempt)
			if d < min || d >= max {
				t.Fatalf("attempt=%d sample=%d: %v outside [%v,%v)", attempt, i, d, min, max)
			}
		}
	}
}

func TestJitteredBackoffDecorrelates(t *testing.T) {
	base := 25 * time.Millisecond
	seen := map[time.Duration]int{}
	for i := 0; i < 200; i++ {
		seen[jitteredBackoff(base, 0)]++
	}
	if len(seen) < 50 {
		t.Errorf("expected wide jitter distribution, got %d unique values across 200 samples", len(seen))
	}
}

func TestCoordinatedGrantRefreshCoalescesConcurrentCalls(t *testing.T) {
	s := &Server{metrics: &STSMetrics{}}
	done := make(chan struct{})
	calls := make(chan struct{}, 4)
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		err := s.coordinatedGrantRefresh(context.Background(), "grant\x00g1", func(context.Context) *sharederr.CaracalError {
			calls <- struct{}{}
			<-done
			return nil
		})
		if err != nil {
			t.Errorf("coordinatedGrantRefresh: %v", err)
		}
	}()
	<-calls
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			err := s.coordinatedGrantRefresh(context.Background(), "grant\x00g1", func(context.Context) *sharederr.CaracalError {
				calls <- struct{}{}
				<-done
				return nil
			})
			if err != nil {
				t.Errorf("coordinatedGrantRefresh: %v", err)
			}
		}()
	}
	time.Sleep(25 * time.Millisecond)
	select {
	case <-calls:
		t.Fatal("refresh was not coalesced")
	default:
	}
	close(done)
	wg.Wait()
	if len(calls) != 0 {
		t.Fatal("refresh was invoked more than once")
	}
	if s.metrics.ProviderRefreshShared.Load() == 0 {
		t.Fatal("shared refresh metric was not recorded")
	}
}

func TestRefreshCoordinationKeysHideRawGrantMaterial(t *testing.T) {
	lockKey, resultKey := refreshCoordinationKeys("zone\x00user\x00resource\x00provider")
	if lockKey == resultKey {
		t.Fatal("lock and result keys must differ")
	}
	if strings.Contains(lockKey, "zone") || strings.Contains(resultKey, "user") {
		t.Fatalf("coordination keys must not expose raw grant material: %q %q", lockKey, resultKey)
	}
}

func TestRefreshResultRoundTripError(t *testing.T) {
	err := sharederr.New(sharederr.STSUnavailable, "provider unavailable")
	result := refreshResultFromError(err)
	if result.OK {
		t.Fatal("error result must not report OK")
	}
	if result.Code != sharederr.STSUnavailable || result.Description != "provider unavailable" {
		t.Fatalf("unexpected result: %+v", result)
	}
}
