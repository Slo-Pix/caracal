# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Decision tests for the Lynx Capital policy library, runnable with `opa test policies/`.
package caracal.authz_test

import data.caracal.authz
import rego.v1

# A token-exchange input for customer `customer` on plan `plan`, principal capabilities
# `caps`, targeting `resource` and requesting `scopes`. The principal is always the one
# managed application; the customer travels only in the subject claims.
request(customer, plan, caps, resource, scopes) := {
	"action": {"id": "TokenExchange"},
	"principal": {
		"id": "app_lynx_platform",
		"registration_method": "managed",
		"labels": caps,
	},
	"resource": {"identifier": resource},
	"context": {
		"requested_scopes": scopes,
		"subject_claims": {"customer_id": customer, "plan": plan},
	},
}

test_portfolio_read_allows if {
	authz.result.decision == "allow" with input as request(
		"aurora", "growth", ["portfolio-read"], "resource://portfolio", ["portfolio:read"],
	)
}

test_portfolio_read_capability_cannot_write if {
	authz.result.decision == "deny" with input as request(
		"aurora", "growth", ["portfolio-read"], "resource://portfolio", ["portfolio:write"],
	)
}

test_portfolio_write_allows if {
	authz.result.decision == "allow" with input as request(
		"aurora", "growth", ["portfolio-write"], "resource://portfolio", ["portfolio:write"],
	)
}

test_research_read_and_write if {
	authz.result.decision == "allow" with input as request(
		"borealis", "growth", ["research-read", "research-write"], "resource://research",
		["research:read", "research:write"],
	)
}

test_compliance_review_allows if {
	authz.result.decision == "allow" with input as request(
		"aurora", "growth", ["compliance-review"], "resource://compliance", ["compliance:review"],
	)
}

test_compliance_admin_allows if {
	authz.result.decision == "allow" with input as request(
		"aurora", "growth", ["compliance-admin"], "resource://compliance", ["compliance:admin"],
	)
}

# Customer scoping: a request that carries no customer subject is denied. The shared
# managed-application credential alone can never read customer data.
test_request_without_customer_subject_is_denied if {
	authz.result.decision == "deny" with input as {
		"action": {"id": "TokenExchange"},
		"principal": {"id": "app_lynx_platform", "registration_method": "managed", "labels": ["portfolio-read"]},
		"resource": {"identifier": "resource://portfolio"},
		"context": {"requested_scopes": ["portfolio:read"], "subject_claims": {}},
	}
}

# A portfolio capability does not leak into the research resource.
test_capability_does_not_cross_resource if {
	authz.result.decision == "deny" with input as request(
		"aurora", "growth", ["portfolio-write"], "resource://research", ["research:write"],
	)
}

# Plan entitlement: portfolio administration is a premium capability. Enterprise allows it;
# the same capability label on a growth-plan customer is denied — one role, per-customer authority.
test_portfolio_admin_allows_on_premium_plan if {
	authz.result.decision == "allow" with input as request(
		"aurora", "enterprise", ["portfolio-admin"], "resource://portfolio", ["portfolio:admin"],
	)
}

test_portfolio_admin_denied_on_growth_plan if {
	authz.result.decision == "deny" with input as request(
		"borealis", "growth", ["portfolio-admin"], "resource://portfolio", ["portfolio:admin"],
	)
}

test_customer_admin_spans_resources_on_premium_plan if {
	authz.result.decision == "allow" with input as request(
		"aurora", "enterprise", ["customer-admin"], "resource://compliance", ["compliance:admin"],
	)
}

test_customer_admin_denied_on_growth_plan if {
	authz.result.decision == "deny" with input as request(
		"borealis", "growth", ["customer-admin"], "resource://portfolio", ["portfolio:admin"],
	)
}

test_auditor_reads_every_resource if {
	authz.result.decision == "allow" with input as request(
		"aurora", "growth", ["auditor"], "resource://research", ["research:read"],
	)
}

test_auditor_cannot_write if {
	authz.result.decision == "deny" with input as request(
		"aurora", "growth", ["auditor"], "resource://portfolio", ["portfolio:write"],
	)
}

# Delegated advisor: allowed only for scopes carried on the delegation edge.
test_delegated_advisor_within_edge if {
	authz.result.decision == "allow" with input as object.union(
		request("aurora", "growth", ["delegated-advisor"], "resource://research", ["research:read"]),
		{"delegation_edge": {"id": "edge-1", "scopes": ["research:read"]}},
	)
}

test_delegated_advisor_cannot_exceed_edge if {
	authz.result.decision == "deny" with input as object.union(
		request("aurora", "growth", ["delegated-advisor"], "resource://portfolio", ["portfolio:read"]),
		{"delegation_edge": {"id": "edge-1", "scopes": ["research:read"]}},
	)
}

test_delegated_advisor_requires_an_edge if {
	authz.result.decision == "deny" with input as request(
		"aurora", "growth", ["delegated-advisor"], "resource://research", ["research:read"],
	)
}

# Emergency access: denied without a step-up, and raises a step-up diagnostic.
test_emergency_without_step_up_is_denied if {
	result := authz.result with input as object.union(
		request("aurora", "enterprise", ["emergency-access"], "resource://portfolio", ["portfolio:admin"]),
		{"context": {
			"requested_scopes": ["portfolio:admin"],
			"subject_claims": {"customer_id": "aurora", "plan": "enterprise"},
			"challenge_resolved": false,
		}},
	)
	result.decision == "deny"
	result.diagnostics[_] == {"step_up_required": "mfa"}
}

test_emergency_with_step_up_allows if {
	authz.result.decision == "allow" with input as object.union(
		request("aurora", "enterprise", ["emergency-access"], "resource://portfolio", ["portfolio:admin"]),
		{"context": {
			"requested_scopes": ["portfolio:admin"],
			"subject_claims": {"customer_id": "aurora", "plan": "enterprise"},
			"challenge_resolved": true,
		}},
	)
}

# A principal with no Lynx capability is denied by the default-deny base.
test_unlabelled_principal_is_denied if {
	authz.result.decision == "deny" with input as request(
		"aurora", "growth", [], "resource://portfolio", ["portfolio:read"],
	)
}
