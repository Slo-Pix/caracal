// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// STS Redis client deterministic behavior tests.

package internal

import (
	"context"
	"strings"
	"testing"
	"time"

	corecrypto "github.com/garudex-labs/caracal/packages/core/go/crypto"
)

func TestNewRedisParsesURLsWithoutConnecting(t *testing.T) {
	client, err := newRedis("redis://localhost:6379/0")
	if err != nil {
		t.Fatalf("valid redis url should parse: %v", err)
	}
	if client == nil || client.c == nil {
		t.Fatal("valid redis url should create a client")
	}
	if err := client.c.Close(); err != nil {
		t.Fatalf("close redis client: %v", err)
	}
	if _, err := newRedis("://bad-url"); err == nil {
		t.Fatal("invalid redis url should fail")
	}
}

func TestRedisStreamSigningVerificationModes(t *testing.T) {
	values := map[string]any{"zone_id": "zone-1", "event": "policy.updated"}
	client := &RedisClient{}
	if !client.VerifyStream(streamPolicy, values) {
		t.Fatal("unsigned stream should verify when signatures are disabled")
	}

	key := []byte("12345678901234567890123456789012")
	client.SetStreamSigning(key, true)
	signed := map[string]any{"zone_id": "zone-1", "event": "policy.updated"}
	signed[corecrypto.StreamSigField] = corecrypto.SignStream(key, streamPolicy, signed)
	if !client.VerifyStream(streamPolicy, signed) {
		t.Fatal("valid stream signature should verify")
	}
	if client.VerifyStream(streamKeys, signed) {
		t.Fatal("signature must bind to the stream name")
	}
	signed["event"] = "tampered"
	if client.VerifyStream(streamPolicy, signed) {
		t.Fatal("signature must bind to message values")
	}
}

func TestRedisSignedXAddRequiresConfiguredKeyBeforeNetwork(t *testing.T) {
	client := &RedisClient{}
	client.SetStreamSigning(nil, true)
	err := client.SignedXAdd(context.Background(), streamPolicy, map[string]any{"zone_id": "zone-1"})
	if err == nil || !strings.Contains(err.Error(), "stream signing required") {
		t.Fatalf("missing signing key error = %v", err)
	}
}

func TestRedisSetTTLReturnsMarshalErrorsBeforeNetwork(t *testing.T) {
	client := &RedisClient{}
	err := client.SetTTL(context.Background(), "key", func() {}, time.Minute)
	if err == nil {
		t.Fatal("unmarshalable values should fail before Redis I/O")
	}
}
