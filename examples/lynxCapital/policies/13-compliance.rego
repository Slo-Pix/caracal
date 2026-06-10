# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Compliance boundary: screening, monitoring, tax, and policy-archive provider views.
package caracal.authz

import rego.v1

# A spawned compliance agent minting a resource mandate: the requested scopes must sit
# inside both its delegation edge and its role's grant on the view.
result := allow_result("lynx-compliance-mint") if {
principal_app == "compliance"
principal_owns_resource
worker_mint
mint_role_allowed
}

# A spawned compliance agent presenting its mandate at the Gateway for this view.
result := allow_result("lynx-compliance-use") if {
principal_app == "compliance"
principal_owns_resource
mandate_use
use_role_allowed
}
