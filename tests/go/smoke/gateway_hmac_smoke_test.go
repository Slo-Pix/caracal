// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Smoke test for the gateway/STS HMAC exchange contract.

package smoke_test

import (
	"crypto/rand"
	"strconv"
	"testing"
	"time"

	corests "github.com/garudex-labs/caracal/packages/core/go/sts"
)

func TestGatewayHMACRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		t.Fatalf("rand: %v", err)
	}
	body := []byte(`{"policy_set_id":"ps_1","version_id":"v1"}`)
	now := time.Now().UTC()
	ts := strconv.FormatInt(now.Unix(), 10)
	sig := corests.SignGatewayExchange(key, now, "req_smoke", body)
	if sig == "" {
		t.Fatal("empty signature")
	}
	if err := corests.VerifyGatewayExchange(key, now, 30*time.Second, ts, "req_smoke", sig, body); err != nil {
		t.Fatalf("verify: %v", err)
	}
	if err := corests.VerifyGatewayExchange(key, now, 30*time.Second, ts, "req_smoke", sig, []byte(`{"tampered":true}`)); err == nil {
		t.Fatal("verify accepted tampered body")
	}
	skewed := now.Add(10 * time.Minute)
	if err := corests.VerifyGatewayExchange(key, skewed, 30*time.Second, ts, "req_smoke", sig, body); err == nil {
		t.Fatal("verify accepted out-of-skew timestamp")
	}
}
