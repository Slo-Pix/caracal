# caracal:data-document
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Application bindings: the control-plane application ids each policy keys on.
# scripts/provision.py authors this document with the created application UUIDs;
# the committed values are placeholders for offline policy tests.
# Bindings are data for the shared rules in 00-base; this document never decides.
package caracal.authz

import rego.v1

app_ids := {
	"operations": "app-operations",
	"intake": "app-intake",
	"ledger": "app-ledger",
	"compliance": "app-compliance",
	"treasury": "app-treasury",
	"payments": "app-payments",
	"audit": "app-audit",
}
