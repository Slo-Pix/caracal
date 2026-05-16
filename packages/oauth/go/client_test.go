// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// OAuth Go client tests for cache isolation and STS response validation.

package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExchangeDoesNotShareCacheAcrossClientSecrets(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]any{
			"access_token": "token-" + r.Form.Get("client_secret"),
			"token_type":   "Bearer",
			"expires_in":   3600,
		}); err != nil {
			t.Fatal(err)
		}
	}))
	defer server.Close()

	client := NewClient(server.URL, "zone1", "app1", nil)
	first, err := client.Exchange(context.Background(), "subject", "resource://api", ExchangeOptions{ClientSecret: "a"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := client.Exchange(context.Background(), "subject", "resource://api", ExchangeOptions{ClientSecret: "b"})
	if err != nil {
		t.Fatal(err)
	}
	third, err := client.Exchange(context.Background(), "subject", "resource://api", ExchangeOptions{ClientSecret: "a"})
	if err != nil {
		t.Fatal(err)
	}

	if first.AccessToken != "token-a" || second.AccessToken != "token-b" || third.AccessToken != "token-a" {
		t.Fatalf("unexpected tokens: %q %q %q", first.AccessToken, second.AccessToken, third.AccessToken)
	}
	if requests != 2 {
		t.Fatalf("expected 2 STS requests, got %d", requests)
	}
}

func TestExchangeRejectsMalformedSuccessResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"access_token":"","token_type":"Bearer","expires_in":3600}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "zone1", "app1", nil)
	if _, err := client.Exchange(context.Background(), "subject", "resource://api", ExchangeOptions{}); err == nil {
		t.Fatal("expected malformed response error")
	}
}

func TestExchangeReturnsInteractionRequiredError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"error":"interaction_required","error_description":"step up","challenge_id":"challenge1","acr_values":"urn:mfa"}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "zone1", "app1", nil)
	_, err := client.Exchange(context.Background(), "subject", "resource://api", ExchangeOptions{})
	var interaction *InteractionRequiredError
	if !errors.As(err, &interaction) {
		t.Fatalf("expected InteractionRequiredError, got %T", err)
	}
	if interaction.ChallengeID != "challenge1" || interaction.Resource != "resource://api" {
		t.Fatalf("unexpected interaction error: %+v", interaction)
	}
}

func TestExchangeRetriesOnceAfterUnauthorized(t *testing.T) {
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests++
		w.Header().Set("Content-Type", "application/json")
		if requests == 1 {
			w.WriteHeader(http.StatusUnauthorized)
			w.Write([]byte(`{"error_description":"expired client credential"}`))
			return
		}
		w.Write([]byte(`{"access_token":"fresh","token_type":"Bearer","expires_in":3600}`))
	}))
	defer server.Close()

	client := NewClient(server.URL, "zone1", "app1", nil)
	token, err := client.Exchange(context.Background(), "subject", "resource://api", ExchangeOptions{Retries: 0})
	if err != nil {
		t.Fatal(err)
	}
	if token.AccessToken != "fresh" || requests != 2 {
		t.Fatalf("expected one 401 retry and fresh token, got token=%q requests=%d", token.AccessToken, requests)
	}
}
