// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Coordinator relay configuration tests.

package internal

import (
	"context"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	sharedcrypto "github.com/garudex-labs/caracal/packages/core/go/crypto"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

type fakeRedis struct {
	xreadGroups []xreadGroupResult
	xautoClaims []xautoClaimResult
	groupErr    error
	ackErr      error
	setNXVal    bool
	setNXErr    error
	acks        []string
	setNXKeys   []string
}

type xreadGroupResult struct {
	streams []redis.XStream
	err     error
}

type xautoClaimResult struct {
	messages []redis.XMessage
	next     string
	err      error
}

func (f *fakeRedis) XAck(_ context.Context, _ string, _ string, ids ...string) *redis.IntCmd {
	f.acks = append(f.acks, ids...)
	return redis.NewIntResult(int64(len(ids)), f.ackErr)
}

func (f *fakeRedis) XAutoClaim(ctx context.Context, _ *redis.XAutoClaimArgs) *redis.XAutoClaimCmd {
	cmd := redis.NewXAutoClaimCmd(ctx)
	if len(f.xautoClaims) == 0 {
		cmd.SetVal(nil, "0-0")
		return cmd
	}
	result := f.xautoClaims[0]
	f.xautoClaims = f.xautoClaims[1:]
	if result.err != nil {
		cmd.SetErr(result.err)
		return cmd
	}
	cmd.SetVal(result.messages, result.next)
	return cmd
}

func (f *fakeRedis) XGroupCreateMkStream(context.Context, string, string, string) *redis.StatusCmd {
	return redis.NewStatusResult("OK", f.groupErr)
}

func (f *fakeRedis) XReadGroup(context.Context, *redis.XReadGroupArgs) *redis.XStreamSliceCmd {
	if len(f.xreadGroups) == 0 {
		return redis.NewXStreamSliceCmdResult(nil, redis.Nil)
	}
	result := f.xreadGroups[0]
	f.xreadGroups = f.xreadGroups[1:]
	return redis.NewXStreamSliceCmdResult(result.streams, result.err)
}

func (f *fakeRedis) SetNX(_ context.Context, key string, _ any, _ time.Duration) *redis.BoolCmd {
	f.setNXKeys = append(f.setNXKeys, key)
	return redis.NewBoolResult(f.setNXVal, f.setNXErr)
}

func testConsumer(r *fakeRedis) *Consumer {
	return &Consumer{
		redis:        r,
		log:          zerolog.Nop(),
		consumerName: "relay-test",
		dedupeTTL:    time.Minute,
		claimIdle:    time.Millisecond,
	}
}

func TestLoadConfigDoesNotRequirePortOrDatabase(t *testing.T) {
	t.Setenv("CARACAL_MODE", "dev")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("PORT", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("STREAMS_HMAC_KEY", "")
	t.Setenv("STREAMS_HMAC_KEY_FILE", "")

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("loadConfig should not require unrelated service env vars: %v", err)
	}
	if cfg.RedisURL == "" {
		t.Fatal("Redis URL must be loaded")
	}
}

func TestLoadConfigResolvesStreamHMACKeyFile(t *testing.T) {
	key := make([]byte, 32)
	encoded := hex.EncodeToString(key)
	path := filepath.Join(t.TempDir(), "stream-key")
	if err := os.WriteFile(path, []byte(encoded+"\n"), 0o600); err != nil {
		t.Fatalf("write key file: %v", err)
	}

	t.Setenv("CARACAL_MODE", "stable")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("STREAMS_HMAC_KEY", "")
	t.Setenv("STREAMS_HMAC_KEY_FILE", path)

	cfg, err := loadConfig()
	if err != nil {
		t.Fatalf("loadConfig should resolve STREAMS_HMAC_KEY_FILE: %v", err)
	}
	if !cfg.RequireSig || len(cfg.StreamHMACKey) != 32 {
		t.Fatalf("stable relay must require and load a 32-byte stream key, got require=%v len=%d", cfg.RequireSig, len(cfg.StreamHMACKey))
	}
}

func TestPositiveSecondsRejectsInvalidValues(t *testing.T) {
	t.Setenv("RELAY_CLAIM_IDLE_SEC", "0")
	if _, err := positiveSeconds("RELAY_CLAIM_IDLE_SEC", int(time.Minute/time.Second)); err == nil {
		t.Fatal("zero seconds must fail")
	}
}

func TestPositiveSecondsFallbackAndValid(t *testing.T) {
	t.Setenv("RELAY_DEDUPE_WINDOW_SEC", "")
	got, err := positiveSeconds("RELAY_DEDUPE_WINDOW_SEC", 42)
	if err != nil {
		t.Fatalf("unset value should fall back without error: %v", err)
	}
	if got != 42 {
		t.Fatalf("expected fallback 42, got %d", got)
	}

	t.Setenv("RELAY_DEDUPE_WINDOW_SEC", "120")
	got, err = positiveSeconds("RELAY_DEDUPE_WINDOW_SEC", 42)
	if err != nil {
		t.Fatalf("valid value should parse: %v", err)
	}
	if got != 120 {
		t.Fatalf("expected parsed 120, got %d", got)
	}
}

func TestPositiveSecondsRejectsNonNumeric(t *testing.T) {
	t.Setenv("RELAY_DEDUPE_WINDOW_SEC", "abc")
	if _, err := positiveSeconds("RELAY_DEDUPE_WINDOW_SEC", 1); err == nil {
		t.Fatal("non-numeric value must fail")
	}
}

func TestLoadConfigRequiresHMACKeyInStable(t *testing.T) {
	t.Setenv("CARACAL_MODE", "stable")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("STREAMS_HMAC_KEY", "")
	t.Setenv("STREAMS_HMAC_KEY_FILE", "")

	if _, err := loadConfig(); err == nil {
		t.Fatal("stable mode must require a stream HMAC key")
	}
}

func TestLoadConfigRejectsInvalidHMACKey(t *testing.T) {
	t.Setenv("CARACAL_MODE", "dev")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("STREAMS_HMAC_KEY", "not-hex")
	t.Setenv("STREAMS_HMAC_KEY_FILE", "")

	if _, err := loadConfig(); err == nil {
		t.Fatal("a non-hex stream HMAC key must be rejected")
	}
}

func TestStringVal(t *testing.T) {
	if got := stringVal("value"); got != "value" {
		t.Fatalf("expected string passthrough, got %q", got)
	}
	if got := stringVal(42); got != "" {
		t.Fatalf("non-string must coerce to empty string, got %q", got)
	}
	if got := stringVal(nil); got != "" {
		t.Fatalf("nil must coerce to empty string, got %q", got)
	}
}

func TestVerifyDevModeWithoutKeyAllowsAll(t *testing.T) {
	c := &Consumer{requireSig: false}
	if !c.verify(map[string]any{"event": "spawn"}) {
		t.Fatal("dev mode without a key must accept every message")
	}
}

func TestVerifyWithKeyAcceptsValidAndRejectsTampered(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	c := &Consumer{requireSig: true, streamHMACKey: key}

	values := map[string]any{"event": "spawn", "zone_id": "z1"}
	values[sharedcrypto.StreamSigField] = sharedcrypto.SignStream(key, lifecycleStream, values)
	if !c.verify(values) {
		t.Fatal("a correctly signed lifecycle event must verify")
	}

	values["zone_id"] = "tampered"
	if c.verify(values) {
		t.Fatal("a tampered lifecycle event must not verify")
	}
}

func TestNewConstructsConsumerFromValidConfig(t *testing.T) {
	t.Setenv("CARACAL_MODE", "dev")
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("STREAMS_HMAC_KEY", "")
	t.Setenv("STREAMS_HMAC_KEY_FILE", "")

	c, err := New(context.Background())
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	if c.redis == nil || c.consumerName == "" || c.dedupeTTL != time.Hour || c.claimIdle != time.Minute {
		t.Fatalf("unexpected consumer defaults: %#v", c)
	}
}

func TestNewRejectsInvalidRedisURL(t *testing.T) {
	t.Setenv("CARACAL_MODE", "dev")
	t.Setenv("REDIS_URL", "://bad")
	t.Setenv("STREAMS_HMAC_KEY", "")
	t.Setenv("STREAMS_HMAC_KEY_FILE", "")

	if _, err := New(context.Background()); err == nil {
		t.Fatal("expected invalid Redis URL error")
	}
}

func TestEnsureGroupTreatsBusyGroupAsSuccess(t *testing.T) {
	c := testConsumer(&fakeRedis{groupErr: errors.New("BUSYGROUP Consumer Group name already exists")})

	if err := c.ensureGroup(context.Background()); err != nil {
		t.Fatalf("BUSYGROUP should be ignored: %v", err)
	}
}

func TestEnsureGroupReturnsUnexpectedError(t *testing.T) {
	c := testConsumer(&fakeRedis{groupErr: errors.New("redis down")})

	if err := c.ensureGroup(context.Background()); err == nil {
		t.Fatal("expected ensureGroup error")
	}
}

func TestDuplicateHandlesMissingIDsSetNXResultsAndErrors(t *testing.T) {
	c := testConsumer(&fakeRedis{})
	if c.duplicate(context.Background(), map[string]any{}) {
		t.Fatal("message without outbox_id must not be duplicate")
	}
	if c.duplicate(context.Background(), map[string]any{"outbox_id": 42}) {
		t.Fatal("non-string outbox_id must not be duplicate")
	}
	if c.duplicate(context.Background(), map[string]any{"outbox_id": ""}) {
		t.Fatal("empty outbox_id must not be duplicate")
	}

	r := &fakeRedis{setNXVal: true}
	c = testConsumer(r)
	if c.duplicate(context.Background(), map[string]any{"outbox_id": "outbox-1"}) {
		t.Fatal("fresh outbox_id must not be duplicate")
	}
	if len(r.setNXKeys) != 1 || !strings.Contains(r.setNXKeys[0], "outbox-1") {
		t.Fatalf("unexpected dedupe keys: %v", r.setNXKeys)
	}

	c = testConsumer(&fakeRedis{setNXVal: false})
	if !c.duplicate(context.Background(), map[string]any{"outbox_id": "outbox-1"}) {
		t.Fatal("existing outbox_id must be duplicate")
	}

	c = testConsumer(&fakeRedis{setNXErr: errors.New("redis unavailable")})
	if c.duplicate(context.Background(), map[string]any{"outbox_id": "outbox-1"}) {
		t.Fatal("dedupe errors should proceed as non-duplicates")
	}
}

func TestProcessMessageAcksInvalidDuplicateAndAcceptedMessages(t *testing.T) {
	r := &fakeRedis{setNXVal: false}
	c := testConsumer(r)
	c.requireSig = true
	c.processMessage(context.Background(), redis.XMessage{ID: "bad", Values: map[string]any{"event": "spawn"}})
	if len(r.acks) != 1 || r.acks[0] != "bad" {
		t.Fatalf("invalid signature ack = %v", r.acks)
	}

	c.requireSig = false
	c.processMessage(context.Background(), redis.XMessage{ID: "duplicate", Values: map[string]any{"outbox_id": "outbox-1"}})
	c.redis = &fakeRedis{setNXVal: true}
	c.processMessage(context.Background(), redis.XMessage{ID: "ok", Values: map[string]any{"event": "spawn", "zone_id": "zone-a"}})

	if len(r.acks) != 2 || r.acks[1] != "duplicate" {
		t.Fatalf("duplicate ack = %v", r.acks)
	}
	accepted := c.redis.(*fakeRedis)
	if len(accepted.acks) != 1 || accepted.acks[0] != "ok" {
		t.Fatalf("accepted ack = %v", accepted.acks)
	}
}

func TestAckLogsAndContinuesOnFailure(t *testing.T) {
	r := &fakeRedis{ackErr: errors.New("ack failed")}
	c := testConsumer(r)

	c.ack(context.Background(), "msg-1")

	if len(r.acks) != 1 || r.acks[0] != "msg-1" {
		t.Fatalf("ack IDs = %v", r.acks)
	}
}

func TestDrainPELProcessesMessagesUntilRedisNilEmptyOrError(t *testing.T) {
	r := &fakeRedis{xreadGroups: []xreadGroupResult{
		{streams: []redis.XStream{{Messages: []redis.XMessage{{ID: "1-0", Values: map[string]any{"event": "spawn"}}}}}},
		{err: redis.Nil},
	}}
	c := testConsumer(r)

	if err := c.drainPEL(context.Background()); err != nil {
		t.Fatalf("drainPEL: %v", err)
	}
	if len(r.acks) != 1 || r.acks[0] != "1-0" {
		t.Fatalf("drain acks = %v", r.acks)
	}

	c = testConsumer(&fakeRedis{xreadGroups: []xreadGroupResult{{streams: []redis.XStream{{}}}}})
	if err := c.drainPEL(context.Background()); err != nil {
		t.Fatalf("empty stream should end drain: %v", err)
	}

	c = testConsumer(&fakeRedis{xreadGroups: []xreadGroupResult{{err: errors.New("redis down")}}})
	if err := c.drainPEL(context.Background()); err == nil {
		t.Fatal("expected drain error")
	}
}

func TestReapOnceProcessesClaimedMessagesAndStopsAtEnd(t *testing.T) {
	r := &fakeRedis{xautoClaims: []xautoClaimResult{
		{messages: []redis.XMessage{{ID: "1-0", Values: map[string]any{"event": "spawn"}}}, next: "2-0"},
		{messages: nil, next: "0-0"},
	}}
	c := testConsumer(r)

	c.reapOnce(context.Background())

	if len(r.acks) != 1 || r.acks[0] != "1-0" {
		t.Fatalf("reap acks = %v", r.acks)
	}
}

func TestReapOnceReturnsOnErrors(t *testing.T) {
	for _, err := range []error{context.Canceled, errors.New("redis down")} {
		t.Run(err.Error(), func(t *testing.T) {
			c := testConsumer(&fakeRedis{xautoClaims: []xautoClaimResult{{err: err}}})
			c.reapOnce(context.Background())
		})
	}
}

func TestReapLoopStopsWhenContextIsCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c := testConsumer(&fakeRedis{})

	c.reapLoop(ctx)
}

func TestRunReturnsImmediatelyWhenContextIsCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c := testConsumer(&fakeRedis{})

	if err := c.Run(ctx); err != nil {
		t.Fatalf("Run canceled context: %v", err)
	}
}

func TestRunHandlesStartupErrorsAndCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	r := &fakeRedis{groupErr: errors.New("redis down")}
	c := testConsumer(r)
	go func() {
		time.Sleep(10 * time.Millisecond)
		cancel()
	}()

	if err := c.Run(ctx); err != nil {
		t.Fatalf("Run should stop cleanly on cancellation: %v", err)
	}
}

func TestRunProcessesLiveMessagesUntilCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	r := &fakeRedis{xreadGroups: []xreadGroupResult{
		{err: redis.Nil},
		{streams: []redis.XStream{{Messages: []redis.XMessage{{ID: "1-0", Values: map[string]any{"event": "spawn", "zone_id": "zone-a"}}}}}},
	}}
	c := testConsumer(r)
	go func() {
		time.Sleep(10 * time.Millisecond)
		cancel()
	}()

	if err := c.Run(ctx); err != nil {
		t.Fatalf("Run live messages: %v", err)
	}
	if len(r.acks) != 1 || r.acks[0] != "1-0" {
		t.Fatalf("live acks = %v", r.acks)
	}
}
