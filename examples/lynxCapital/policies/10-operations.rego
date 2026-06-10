# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Operations orchestration boundary: relay automation views for swarm coordination work.
package caracal.authz

import rego.v1

# A spawned operations agent minting a resource mandate: the requested scopes must sit
# inside both its delegation edge and its role's grant on the view.
result := allow_result("lynx-operations-mint") if {
principal_app == "operations"
principal_owns_resource
worker_mint
mint_role_allowed
}

# A spawned operations agent presenting its mandate at the Gateway for this view.
result := allow_result("lynx-operations-use") if {
principal_app == "operations"
principal_owns_resource
mandate_use
use_role_allowed
}
