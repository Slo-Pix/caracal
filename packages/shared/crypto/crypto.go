// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// ChaCha20-Poly1305 envelope encryption and ECDSA P-256 key generation.

package crypto

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"

	"golang.org/x/crypto/chacha20poly1305"
)

// Seal encrypts plaintext with ChaCha20-Poly1305 under key.
// Returns (ciphertext, nonce) for storage alongside the encrypted blob.
func Seal(key, plaintext []byte) (ciphertext, nonce []byte, err error) {
	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, nil, err
	}
	n := make([]byte, aead.NonceSize())
	if _, err = rand.Read(n); err != nil {
		return nil, nil, err
	}
	return aead.Seal(nil, n, plaintext, nil), n, nil
}

// Open decrypts a ciphertext produced by Seal.
func Open(key, nonce, ciphertext []byte) ([]byte, error) {
	aead, err := chacha20poly1305.New(key)
	if err != nil {
		return nil, err
	}
	return aead.Open(nil, nonce, ciphertext, nil)
}

// GenerateP256Key generates a new ECDSA P-256 key pair for zone JWT signing.
func GenerateP256Key() (*ecdsa.PrivateKey, error) {
	return ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
}
