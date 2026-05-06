// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// JSON unmarshalling helper for audit event payloads.

package internal

import "encoding/json"

// jsonUnmarshalStrict decodes raw into v. Unknown fields are tolerated so
// producer/consumer schema drift does not cause silent event loss; the
// canonical hash and HMAC remain bound to the raw bytes.
func jsonUnmarshalStrict(raw string, v any) error {
	return json.Unmarshal([]byte(raw), v)
}
