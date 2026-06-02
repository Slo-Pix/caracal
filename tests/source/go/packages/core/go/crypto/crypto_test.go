// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared crypto unit tests for envelope encryption and signing key generation.

package crypto

import "testing"

func TestSealOpenRoundTrip(t *testing.T) {
	key := make([]byte, 32)
	ciphertext, nonce, err := Seal(key, []byte("secret payload"))
	if err != nil {
		t.Fatalf("seal: %v", err)
	}
	plaintext, err := Open(key, nonce, ciphertext)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	if string(plaintext) != "secret payload" {
		t.Fatalf("want original payload, got %q", plaintext)
	}
}

func TestOpenRejectsWrongKey(t *testing.T) {
	key := make([]byte, 32)
	ciphertext, nonce, err := Seal(key, []byte("secret payload"))
	if err != nil {
		t.Fatalf("seal: %v", err)
	}
	wrongKey := make([]byte, 32)
	wrongKey[0] = 1
	if _, err := Open(wrongKey, nonce, ciphertext); err == nil {
		t.Fatal("expected wrong key to fail authentication")
	}
}

func TestSealRejectsInvalidKeySize(t *testing.T) {
	if _, _, err := Seal(make([]byte, 16), []byte("payload")); err == nil {
		t.Fatal("expected an error sealing with an undersized key")
	}
}

func TestOpenRejectsInvalidKeySize(t *testing.T) {
	if _, err := Open(make([]byte, 16), make([]byte, 12), []byte("ciphertext")); err == nil {
		t.Fatal("expected an error opening with an undersized key")
	}
}

func TestGenerateP256Key(t *testing.T) {
	key, err := GenerateP256Key()
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	if key.Curve == nil || key.X == nil || key.Y == nil || key.D == nil {
		t.Fatalf("generated key is incomplete: %#v", key)
	}
}
