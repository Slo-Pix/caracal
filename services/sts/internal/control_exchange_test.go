// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for Control key token exchange authorization.

package internal

import "testing"

func TestIsControlKeyExchange(t *testing.T) {
	app := &Application{ID: "app-1", Traits: []string{controlInvokeTrait}}
	req := TokenExchangeRequest{ApplicationID: "app-1"}
	resource := &Resource{Identifier: defaultControlAudience}

	if !isControlKeyExchange(app, req, resource, []string{"control:zone:read"}) {
		t.Fatalf("expected control key exchange to be allowed")
	}

	for name, tc := range map[string]struct {
		app      *Application
		req      TokenExchangeRequest
		resource *Resource
		scopes   []string
	}{
		"missing trait": {
			app:      &Application{ID: "app-1"},
			req:      req,
			resource: resource,
			scopes:   []string{"control:zone:read"},
		},
		"wrong resource": {
			app:      app,
			req:      req,
			resource: &Resource{Identifier: "api"},
			scopes:   []string{"control:zone:read"},
		},
		"subject token": {
			app:      app,
			req:      TokenExchangeRequest{ApplicationID: "app-1", SubjectToken: "subject"},
			resource: resource,
			scopes:   []string{"control:zone:read"},
		},
		"empty scopes": {
			app:      app,
			req:      req,
			resource: resource,
			scopes:   nil,
		},
		"non-control scope": {
			app:      app,
			req:      req,
			resource: resource,
			scopes:   []string{"zone:read"},
		},
	} {
		t.Run(name, func(t *testing.T) {
			if isControlKeyExchange(tc.app, tc.req, tc.resource, tc.scopes) {
				t.Fatalf("expected control key exchange to be denied")
			}
		})
	}
}
