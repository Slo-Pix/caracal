# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Platform-owned decision contract: the signed, versioned authorization brain every zone bundle evaluates.
package caracal.authz

import rego.v1

# The whole contract is deny by default. An adopter zone that supplies no data, or a
# request that matches no allow rule below, resolves here.
default result := {
	"decision": "deny",
	"evaluation_status": "complete",
	"determining_policies": [],
	"diagnostics": [{"reason": "no_rule_matched"}],
}

allow_result(policy) := {
	"decision": "allow",
	"evaluation_status": "complete",
	"determining_policies": [{"policy": policy}],
	"diagnostics": [],
}

# Adopter data. grants and app_ids resolve to undefined when a zone omits them, which
# collapses every allow rule to the default deny: a zone with no data authorizes
# nothing. The contract reads these documents; adopters never author the rules below.
resource_grant := data.caracal.authz.grants[input.resource.identifier]

principal_app := key if {
	some key, id in data.caracal.authz.app_ids
	id == input.principal.id
}

principal_owns_resource if {
	resource_grant.application == principal_app
}

# An application bootstrapping its session mandate with its client secret. The only
# permitted scope is agent:lifecycle, and no agent, delegation, or subject context may
# ride along: the mandate authorizes coordinator spawns, not resource calls.
bootstrap_exchange if {
	{scope | some scope in input.context.requested_scopes} == {"agent:lifecycle"}
	not input.context.subject_claims
	not input.delegation_edge
	not input.context.agent_session_id
}

# A spawned agent minting its resource mandate. The exchange must reference the agent
# session and its delegation edge, must not carry a subject token, and every requested
# scope must sit inside the edge's narrowed grant. This subset check is the delegation
# narrowing floor: removing it would let an agent mint authority its parent never held.
delegated_mint if {
	input.delegation_edge.id
	input.context.agent_session_id
	not input.context.subject_claims
	count(input.context.requested_scopes) > 0
	not "agent:lifecycle" in input.context.requested_scopes
	every scope in input.context.requested_scopes {
		scope in input.delegation_edge.scopes
	}
	confinement_satisfied
}

# The agent's role label must grant every requested scope on this resource.
mint_role_allowed if {
	some role in input.principal.labels
	scopes := resource_grant.roles[role]
	every scope in input.context.requested_scopes {
		scope in scopes
	}
}

# Label confinement. Each adopter confinement rule pairs a label prefix with the scope
# set a principal carrying that label may mint. For every rule whose prefix matches one
# of the principal's labels, every requested scope must fall inside the rule's set. A
# principal matching no prefix is unconfined; a zone with no confinement data is
# vacuously satisfied, so confinement only ever narrows authority.
default confinement_list := []

confinement_list := data.caracal.authz.confinement

confinement_satisfied if {
	every rule in confinement_list {
		confinement_rule_satisfied(rule)
	}
}

confinement_rule_satisfied(rule) if {
	not principal_has_prefix(rule.label_prefix)
}

confinement_rule_satisfied(rule) if {
	principal_has_prefix(rule.label_prefix)
	allowed := {scope | some scope in rule.scopes}
	every scope in input.context.requested_scopes {
		scope in allowed
	}
}

principal_has_prefix(prefix) if {
	some label in input.principal.labels
	startswith(label, prefix)
}

# A spawned agent presenting its minted mandate at the Gateway. The mandate must be
# delegation-bound and name this resource in its target audience, and the Gateway
# exchange requests no scopes: authority rides in the mandate claims. Per-operation
# scope authority is enforced natively by the Gateway and STS against the resource's
# declared operations, so this rule decides delegation and view binding only.
mandate_use if {
	input.context.subject_claims.delegation_edge_id != ""
	some target in input.context.subject_claims.target
	target == input.resource.identifier
	not requested_scopes_present
}

requested_scopes_present if {
	count(input.context.requested_scopes) > 0
}

# The presenting agent session must carry a role label granted on this resource.
use_role_allowed if {
	some role in input.principal.labels
	resource_grant.roles[role]
}

# Deny-only extensibility. An adopter may publish restriction reasons as a data
# document; a non-empty set blocks every allow below. Restrictions can only subtract
# authority, never widen it, so a careless restriction fails closed.
restriction_denied if {
	some _ in data.caracal.authz.restrict
}

# An application minting its session lifecycle mandate.
result := allow_result("caracal-bootstrap") if {
	bootstrap_exchange
	principal_owns_resource
	not restriction_denied
}

# A spawned agent minting a resource mandate, narrowed by its delegation edge, confined
# by its labels, and bound to a role its grants allow.
result := allow_result(sprintf("caracal-%s-mint", [principal_app])) if {
	principal_owns_resource
	delegated_mint
	mint_role_allowed
	not restriction_denied
}

# A spawned agent presenting its minted mandate at the Gateway, bound to a role its
# grants allow on the named resource.
result := allow_result(sprintf("caracal-%s-use", [principal_app])) if {
	principal_owns_resource
	mandate_use
	use_role_allowed
	not restriction_denied
}
