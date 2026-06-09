# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Grants administrative access to a customer's portfolio resource for principals carrying
# the portfolio-admin capability.
package caracal.authz

import rego.v1

allowed_scopes contains "portfolio:admin" if {
	portfolio_admin_request
}

determining contains "portfolio-admin" if {
	portfolio_admin_request
}

portfolio_admin_request if {
	input.resource.identifier == "resource://portfolio"
	customer_scoped
	premium_plan
	has_capability("portfolio-admin")
}
