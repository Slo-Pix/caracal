// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for HMAC-SHA256 origin signatures over Redis stream messages.

package crypto

import (
	"encoding/hex"
	"strings"
	"testing"
)

func TestCanonicalizeStreamSortsKeysAndPrefixesStream(t *testing.T) {
	got := string(CanonicalizeStream("events", map[string]any{
		"b": "two",
		"a": "one",
		"c": 3,
	}))
	want := "events\na=one\nb=two\nc=3\n"
	if got != want {
		t.Fatalf("canonical form mismatch:\n got %q\nwant %q", got, want)
	}
}

func TestCanonicalizeStreamSkipsSigFieldAndNilValues(t *testing.T) {
	got := string(CanonicalizeStream("s", map[string]any{
		"keep":         "v",
		StreamSigField: "deadbeef",
		"drop":         nil,
	}))
	want := "s\nkeep=v\n"
	if got != want {
		t.Fatalf("expected sig and nil values skipped:\n got %q\nwant %q", got, want)
	}
}

func TestCanonicalizeStreamEmptyValues(t *testing.T) {
	got := string(CanonicalizeStream("only", map[string]any{}))
	if got != "only\n" {
		t.Fatalf("empty values should yield stream prefix only, got %q", got)
	}
}

func TestCanonicalizeStreamIsDeterministic(t *testing.T) {
	values := map[string]any{"z": 1, "y": 2, "x": 3, "w": 4}
	first := CanonicalizeStream("d", values)
	for i := 0; i < 20; i++ {
		if got := CanonicalizeStream("d", values); string(got) != string(first) {
			t.Fatalf("canonicalization not deterministic on iteration %d", i)
		}
	}
}

func TestSignStreamEmptyKeyReturnsEmpty(t *testing.T) {
	if sig := SignStream(nil, "s", map[string]any{"a": "b"}); sig != "" {
		t.Fatalf("expected empty signature for empty key, got %q", sig)
	}
	if sig := SignStream([]byte{}, "s", map[string]any{"a": "b"}); sig != "" {
		t.Fatalf("expected empty signature for zero-length key, got %q", sig)
	}
}

func TestSignStreamProducesStableHexHMAC(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	values := map[string]any{"a": "1", "b": "2"}
	sig := SignStream(key, "stream", values)
	if sig == "" {
		t.Fatal("expected non-empty signature")
	}
	if _, err := hex.DecodeString(sig); err != nil {
		t.Fatalf("signature is not valid hex: %v", err)
	}
	if again := SignStream(key, "stream", values); again != sig {
		t.Fatalf("signature not stable: %q != %q", again, sig)
	}
}

func TestSignStreamIgnoresExistingSigField(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	base := SignStream(key, "s", map[string]any{"a": "1"})
	withSig := SignStream(key, "s", map[string]any{"a": "1", StreamSigField: "ignored"})
	if base != withSig {
		t.Fatalf("sig field must be excluded from signing: %q != %q", base, withSig)
	}
}

func TestSignStreamDiffersOnValueChange(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	a := SignStream(key, "s", map[string]any{"x": "1"})
	b := SignStream(key, "s", map[string]any{"x": "2"})
	if a == b {
		t.Fatal("signature should change when a signed value changes")
	}
}

func TestVerifyStreamNoKeyAlwaysVerifies(t *testing.T) {
	if !VerifyStream(nil, "s", map[string]any{"a": "1"}) {
		t.Fatal("dev mode (no key) should verify any message")
	}
}

func TestVerifyStreamRoundTrip(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	values := map[string]any{"a": "1", "b": 2}
	values[StreamSigField] = SignStream(key, "s", values)
	if !VerifyStream(key, "s", values) {
		t.Fatal("a freshly signed message must verify")
	}
}

func TestVerifyStreamRejectsMissingSig(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	if VerifyStream(key, "s", map[string]any{"a": "1"}) {
		t.Fatal("message without a sig must not verify when a key is set")
	}
	if VerifyStream(key, "s", map[string]any{"a": "1", StreamSigField: ""}) {
		t.Fatal("message with empty sig must not verify")
	}
}

func TestVerifyStreamRejectsInvalidHexSig(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	values := map[string]any{"a": "1", StreamSigField: "nothex!!"}
	if VerifyStream(key, "s", values) {
		t.Fatal("non-hex signature must not verify")
	}
}

func TestVerifyStreamRejectsTamperedValue(t *testing.T) {
	key := []byte("01234567890123456789012345678901")
	values := map[string]any{"a": "1"}
	values[StreamSigField] = SignStream(key, "s", values)
	values["a"] = "tampered"
	if VerifyStream(key, "s", values) {
		t.Fatal("verification must fail after a signed value is tampered")
	}
}

func TestVerifyStreamRejectsWrongKey(t *testing.T) {
	signKey := []byte("01234567890123456789012345678901")
	values := map[string]any{"a": "1"}
	values[StreamSigField] = SignStream(signKey, "s", values)
	wrongKey := []byte("abcdefghabcdefghabcdefghabcdefgh")
	if VerifyStream(wrongKey, "s", values) {
		t.Fatal("verification must fail under a different key")
	}
}

func TestDecodeStreamKeyEmptyReturnsNil(t *testing.T) {
	k, err := DecodeStreamKey("")
	if err != nil {
		t.Fatalf("empty key should not error: %v", err)
	}
	if k != nil {
		t.Fatalf("empty key should decode to nil, got %v", k)
	}
}

func TestDecodeStreamKeyValid(t *testing.T) {
	raw := make([]byte, 32)
	for i := range raw {
		raw[i] = byte(i)
	}
	k, err := DecodeStreamKey(hex.EncodeToString(raw))
	if err != nil {
		t.Fatalf("valid 32-byte key should decode: %v", err)
	}
	if len(k) != 32 {
		t.Fatalf("expected 32-byte key, got %d bytes", len(k))
	}
}

func TestDecodeStreamKeyRejectsInvalidHex(t *testing.T) {
	if _, err := DecodeStreamKey("zz"); err == nil {
		t.Fatal("invalid hex must error")
	} else if !strings.Contains(err.Error(), "hex decode") {
		t.Fatalf("expected hex decode error, got %v", err)
	}
}

func TestDecodeStreamKeyRejectsShortKey(t *testing.T) {
	short := hex.EncodeToString(make([]byte, 31))
	if _, err := DecodeStreamKey(short); err == nil {
		t.Fatal("keys shorter than 32 bytes must be rejected")
	} else if !strings.Contains(err.Error(), "at least 32 bytes") {
		t.Fatalf("expected length error, got %v", err)
	}
}
