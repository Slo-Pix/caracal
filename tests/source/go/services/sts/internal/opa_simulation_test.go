// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for policy simulation through the STS OPA engine.

package internal

import (
	"context"
	"testing"
)

func TestOPASimulateEvaluatesSuppliedBundle(t *testing.T) {
	engine := newOPAEngine(nil)
	result, err := engine.Simulate(context.Background(), OPAInput{
		SchemaVersion: "2026-05-20",
		Principal:     OPAPrincipal{ZoneID: "z1", ID: "app-calendar", Type: "application"},
		Resource:      OPAResource{ID: "res-1", Identifier: "resource://calendar", Scopes: []string{"calendar:read"}},
		Action:        OPAAction{ID: "token_exchange"},
		Context:       OPAContext{RequestedScopes: []string{"agent:lifecycle"}, ActorClaims: map[string]any{}},
	}, []OPAPolicyModule{{
		ID: "pv-1",
		Content: `package caracal.authz

import rego.v1

grants := {"resource://calendar": {"application": "calendar", "roles": {"reader": ["calendar:read"]}}}
app_ids := {"calendar": "app-calendar"}`,
	}})
	if err != nil {
		t.Fatalf("simulate: %v", err)
	}
	if result.Decision != "allow" {
		t.Fatalf("decision = %q, want allow", result.Decision)
	}
}
