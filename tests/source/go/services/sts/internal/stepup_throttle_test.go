// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// STS step-up throttle behavior tests.

package internal

import (
	"sync"
	"testing"
	"time"
)

func TestStepUpThrottleAllowsNilAndClearsOnSuccess(t *testing.T) {
	var throttle *stepUpThrottle
	if ok, retry := throttle.Allow("zone-1", "principal-1"); !ok || retry != 0 {
		t.Fatalf("nil throttle allow = %v retry=%s", ok, retry)
	}
	throttle.RecordFailure("zone-1", "principal-1")
	throttle.RecordSuccess("zone-1", "principal-1")

	throttle = newStepUpThrottle()
	now := time.Unix(1_700_000_000, 0)
	throttle.now = func() time.Time { return now }
	for range stepUpFailureThreshold {
		throttle.RecordFailure("zone-1", "principal-1")
	}
	if ok, retry := throttle.Allow("zone-1", "principal-1"); ok || retry != stepUpCooldown {
		t.Fatalf("cooldown allow = %v retry=%s", ok, retry)
	}
	throttle.RecordSuccess("zone-1", "principal-1")
	if ok, retry := throttle.Allow("zone-1", "principal-1"); !ok || retry != 0 {
		t.Fatalf("cleared throttle allow = %v retry=%s", ok, retry)
	}
}

func TestStepUpThrottleDropsExpiredFailuresAndHonorsCooldownExpiry(t *testing.T) {
	now := time.Unix(1_700_000_000, 0)
	throttle := newStepUpThrottle()
	throttle.now = func() time.Time { return now }

	for range stepUpFailureThreshold - 1 {
		throttle.RecordFailure("zone-1", "principal-1")
	}
	now = now.Add(stepUpFailureWindow + time.Second)
	throttle.RecordFailure("zone-1", "principal-1")
	if ok, retry := throttle.Allow("zone-1", "principal-1"); !ok || retry != 0 {
		t.Fatalf("expired failures should not block, allow=%v retry=%s", ok, retry)
	}

	for range stepUpFailureThreshold - 1 {
		throttle.RecordFailure("zone-1", "principal-1")
	}
	if ok, retry := throttle.Allow("zone-1", "principal-1"); ok || retry != stepUpCooldown {
		t.Fatalf("threshold should block, allow=%v retry=%s", ok, retry)
	}
	now = now.Add(stepUpCooldown)
	if ok, retry := throttle.Allow("zone-1", "principal-1"); !ok || retry != 0 {
		t.Fatalf("expired cooldown should allow, allow=%v retry=%s", ok, retry)
	}
}

func TestStepUpThrottleSeparatesPrincipalsAndSerializesConcurrentFailures(t *testing.T) {
	throttle := newStepUpThrottle()
	throttle.now = func() time.Time { return time.Unix(1_700_000_000, 0) }

	var wg sync.WaitGroup
	for range stepUpFailureThreshold {
		wg.Add(1)
		go func() {
			defer wg.Done()
			throttle.RecordFailure("zone-1", "principal-1")
		}()
	}
	wg.Wait()

	if ok, _ := throttle.Allow("zone-1", "principal-1"); ok {
		t.Fatal("concurrent threshold failures should block the principal")
	}
	if ok, retry := throttle.Allow("zone-1", "principal-2"); !ok || retry != 0 {
		t.Fatalf("other principal should remain allowed, allow=%v retry=%s", ok, retry)
	}
	if ok, retry := throttle.Allow("zone-2", "principal-1"); !ok || retry != 0 {
		t.Fatalf("other zone should remain allowed, allow=%v retry=%s", ok, retry)
	}
}
