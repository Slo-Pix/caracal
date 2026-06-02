// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Gateway HTTP probe response tests.

package internal

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestReadyFailureReturnsReason(t *testing.T) {
	w := httptest.NewRecorder()
	writeReadyFailure(w, "sts_unreachable")
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["ok"] != false || body["ready"] != false || body["reason"] != "sts_unreachable" {
		t.Fatalf("unexpected body: %#v", body)
	}
}
