// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Delegation constraint unit tests for STS proof validation.

package internal

import "testing"

func TestDelegationAllowsResourceUsesTypedResourceConstraints(t *testing.T) {
	proof := &delegationProof{
		edge:        &DelegationEdge{ID: "edge1"},
		constraints: delegationConstraints{Resources: []string{"calendar"}},
	}
	if !delegationAllowsResource(proof, &Resource{ID: "res1", Identifier: "calendar"}) {
		t.Fatal("resource listed in typed constraints should be allowed")
	}
	if delegationAllowsResource(proof, &Resource{ID: "res2", Identifier: "files"}) {
		t.Fatal("resource outside typed constraints should be denied")
	}
}

func TestParseDelegationConstraintsRejectsUnknownFields(t *testing.T) {
	if _, err := parseDelegationConstraints([]byte(`{"arbitrary":true}`)); err == nil {
		t.Fatal("unknown delegation constraint field should fail closed")
	}
}

func TestParseDelegationConstraintsNormalizesMaxDepth(t *testing.T) {
	constraints, err := parseDelegationConstraints([]byte(`{"max_depth":2,"resources":["calendar"]}`))
	if err != nil {
		t.Fatalf("parse constraints: %v", err)
	}
	if constraints.MaxHops != 2 || len(constraints.Resources) != 1 || constraints.Resources[0] != "calendar" {
		t.Fatalf("unexpected constraints: %#v", constraints)
	}
	if _, err := parseDelegationConstraints([]byte(`{"max_depth":2,"max_hops":3}`)); err == nil {
		t.Fatal("conflicting hop aliases should fail closed")
	}
}
