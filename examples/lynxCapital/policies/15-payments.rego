# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Payments boundary: payout, transfer, and remittance-notice provider views.
package caracal.authz

import rego.v1

# A spawned payments agent minting a resource mandate: the requested scopes must sit
# inside both its delegation edge and its role's grant on the view.
result := allow_result("lynx-payments-mint") if {
principal_app == "payments"
principal_owns_resource
worker_mint
mint_role_allowed
}

# A spawned payments agent presenting its mandate at the Gateway for this view.
result := allow_result("lynx-payments-use") if {
principal_app == "payments"
principal_owns_resource
mandate_use
use_role_allowed
}
