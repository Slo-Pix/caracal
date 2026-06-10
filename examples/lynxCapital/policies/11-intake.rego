# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Intake boundary: invoice capture, vendor onboarding, and procurement provider views.
package caracal.authz

import rego.v1

# A spawned intake agent minting a resource mandate: the requested scopes must sit
# inside both its delegation edge and its role's grant on the view.
result := allow_result("lynx-intake-mint") if {
principal_app == "intake"
principal_owns_resource
worker_mint
mint_role_allowed
}

# A spawned intake agent presenting its mandate at the Gateway for this view.
result := allow_result("lynx-intake-use") if {
principal_app == "intake"
principal_owns_resource
mandate_use
use_role_allowed
}
