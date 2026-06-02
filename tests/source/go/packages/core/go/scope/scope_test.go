// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for OAuth scope matching.

package scope

import (
	"sync"
	"testing"
)

func TestHasMatchesExactScopeTokens(t *testing.T) {
	for _, tc := range []struct {
		name   string
		scope  string
		target string
		want   bool
	}{
		{name: "empty target never matches", scope: "read write", target: "", want: false},
		{name: "empty scope never matches", scope: "", target: "read", want: false},
		{name: "single token match", scope: "read", target: "read", want: true},
		{name: "multi token match", scope: "openid profile email", target: "profile", want: true},
		{name: "substring is not a token", scope: "read:users write:users", target: "read", want: false},
		{name: "case sensitive", scope: "Read write", target: "read", want: false},
		{name: "colon token", scope: "profile tenant:read", target: "tenant:read", want: true},
		{name: "tabs and newlines are delimiters", scope: "read\twrite\nadmin", target: "admin", want: true},
		{name: "duplicate tokens match", scope: "read read", target: "read", want: true},
		{name: "target is not trimmed", scope: "read", target: " read ", want: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := Has(tc.scope, tc.target); got != tc.want {
				t.Fatalf("Has(%q, %q) = %v, want %v", tc.scope, tc.target, got, tc.want)
			}
		})
	}
}

func TestHasIsSafeForConcurrentReaders(t *testing.T) {
	const goroutines = 32
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			if !Has("read write admin", "write") {
				t.Error("expected concurrent scope lookup to match")
			}
		}()
	}
	wg.Wait()
}
