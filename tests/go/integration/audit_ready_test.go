// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Integration test scaffold exercising the audit /ready threshold contract against a live audit service.

package integration_test

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"testing"
	"time"
)

func TestAuditReadyEndpoint(t *testing.T) {
	base := os.Getenv("CARACAL_AUDIT_URL")
	if base == "" {
		t.Skip("CARACAL_AUDIT_URL not set; skipping live audit readiness check")
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(base + "/ready")
	if err != nil {
		t.Fatalf("get /ready: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("unexpected status %d body=%s", resp.StatusCode, string(body))
	}
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("decode body: %v body=%s", err, string(body))
	}
	if _, ok := payload["ready"]; !ok {
		t.Fatalf("missing 'ready' key: %s", string(body))
	}
}
