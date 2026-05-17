// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// JWKS cache tests for fetch, TTL caching, and cache reset behavior.

package identity_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/garudex-labs/caracal/packages/identity/go"
)

func TestGetJWKSFetchesFromWellKnownEndpoint(t *testing.T) {
	identity.ResetJWKSCache()
	var gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{}})
	}))
	defer server.Close()

	_, err := identity.GetJWKS(server.URL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotPath != "/.well-known/jwks.json" {
		t.Fatalf("expected /.well-known/jwks.json, got %q", gotPath)
	}
}

func TestGetJWKSCachesResultAndSkipsRefetch(t *testing.T) {
	identity.ResetJWKSCache()
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{}})
	}))
	defer server.Close()

	if _, err := identity.GetJWKS(server.URL); err != nil {
		t.Fatalf("first fetch failed: %v", err)
	}
	if _, err := identity.GetJWKS(server.URL); err != nil {
		t.Fatalf("second fetch failed: %v", err)
	}

	if calls != 1 {
		t.Fatalf("expected 1 fetch, got %d", calls)
	}
}

func TestResetJWKSCacheForcesRefetch(t *testing.T) {
	identity.ResetJWKSCache()
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []any{}})
	}))
	defer server.Close()

	if _, err := identity.GetJWKS(server.URL); err != nil {
		t.Fatalf("first fetch failed: %v", err)
	}
	identity.ResetJWKSCache()
	if _, err := identity.GetJWKS(server.URL); err != nil {
		t.Fatalf("second fetch failed: %v", err)
	}

	if calls != 2 {
		t.Fatalf("expected 2 fetches after reset, got %d", calls)
	}
}

func TestGetJWKSRejectsNonOKStatus(t *testing.T) {
	identity.ResetJWKSCache()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer server.Close()

	_, err := identity.GetJWKS(server.URL)
	if err == nil {
		t.Fatal("expected error for 503 response")
	}
}

func TestGetJWKSRejectsInvalidJSON(t *testing.T) {
	identity.ResetJWKSCache()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte("{not valid json"))
	}))
	defer server.Close()

	_, err := identity.GetJWKS(server.URL)
	if err == nil {
		t.Fatal("expected error for malformed JSON response")
	}
}
