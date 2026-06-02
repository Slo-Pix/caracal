// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// STS policy simulation HTTP handler tests.

package internal

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	corests "github.com/garudex-labs/caracal/packages/core/go/sts"
	"github.com/rs/zerolog"
)

func TestPolicySimulationRejectsUnsignedMalformedAndEmptyRequests(t *testing.T) {
	server := signedPolicyServer(t)

	w := httptest.NewRecorder()
	server.handlePolicySimulation(w, httptest.NewRequest(http.MethodPost, "/internal/policies/simulate", strings.NewReader(`{}`)))
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unsigned request status = %d", w.Code)
	}

	w = httptest.NewRecorder()
	server.handlePolicySimulation(w, signedSTSRequest(t, server, http.MethodPost, "/internal/policies/simulate", []byte("{bad json"), "req-malformed"))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("malformed request status = %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	server.handlePolicySimulation(w, signedSTSRequest(t, server, http.MethodPost, "/internal/policies/simulate", []byte(`{"policies":[]}`), "req-empty"))
	if w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "policy bundle is empty") {
		t.Fatalf("empty bundle status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestPolicySimulationReturnsOPAErrorsAndSuccessfulResult(t *testing.T) {
	server := signedPolicyServer(t)

	body := []byte(`{"policy_set_id":"ps-1","version_id":"pv-1","manifest_sha256":"sha","policies":[{"id":"bad","content":"package caracal.authz\n\nbroken"}],"input":{"schema_version":"2026-05-20","principal":{"zone_id":"zone-1","id":"app-1","type":"application"},"resource":{"id":"res-1","identifier":"resource://calendar","scopes":["calendar:read"]},"action":{"id":"token_exchange"},"context":{"requested_scopes":["calendar:read"]}}}`)
	w := httptest.NewRecorder()
	server.handlePolicySimulation(w, signedSTSRequest(t, server, http.MethodPost, "/internal/policies/simulate", body, "req-opa-error"))
	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("opa error status=%d body=%s", w.Code, w.Body.String())
	}

	body = []byte(`{"policy_set_id":"ps-1","version_id":"pv-1","manifest_sha256":"sha","policies":[{"id":"pv-1","content":"package caracal.authz\n\nimport rego.v1\n\nresult := {\"decision\": \"allow\", \"evaluation_status\": \"complete\", \"determining_policies\": [{\"policy_version_id\": \"pv-1\"}], \"diagnostics\": []}"}],"input":{"schema_version":"2026-05-20","principal":{"zone_id":"zone-1","id":"app-1","type":"application"},"resource":{"id":"res-1","identifier":"resource://calendar","scopes":["calendar:read"]},"action":{"id":"token_exchange"},"context":{"requested_scopes":["calendar:read"]}}}`)
	w = httptest.NewRecorder()
	server.handlePolicySimulation(w, signedSTSRequest(t, server, http.MethodPost, "/internal/policies/simulate", body, "req-opa-ok"))
	if w.Code != http.StatusOK {
		t.Fatalf("success status=%d body=%s", w.Code, w.Body.String())
	}
	var response policySimulationResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.PolicySetID != "ps-1" || response.VersionID != "pv-1" || response.ManifestSHA != "sha" || response.Result.Decision != "allow" {
		t.Fatalf("unexpected simulation response: %+v", response)
	}
}

func TestPolicyStatusRequiresSignatureAndReportsLoadedBundle(t *testing.T) {
	server := signedPolicyServer(t)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/internal/zones/zone-1/policy/status", nil)
	req.SetPathValue("zoneID", "zone-1")
	server.handlePolicyStatus(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unsigned status request = %d", w.Code)
	}

	w = httptest.NewRecorder()
	req = signedSTSRequest(t, server, http.MethodGet, "/internal/zones/zone-1/policy/status", nil, "req-status-missing-zone")
	server.handlePolicyStatus(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("missing zone status = %d body=%s", w.Code, w.Body.String())
	}

	loadedAt := time.Now().Add(-30 * time.Second).UTC()
	server.opa.zones["zone-1"] = &opaZoneState{policySetVersionID: "pv-1", manifestSHA: "sha", loadedAt: loadedAt}

	w = httptest.NewRecorder()
	req = signedSTSRequest(t, server, http.MethodGet, "/internal/zones/zone-1/policy/status", nil, "req-status-ok")
	req.SetPathValue("zoneID", "zone-1")
	server.handlePolicyStatus(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("loaded status = %d body=%s", w.Code, w.Body.String())
	}
	var response policyStatusResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if !response.Loaded || response.PolicySetVersionID != "pv-1" || response.ManifestSHA != "sha" || response.LoadedAt == "" || response.AgeSeconds < 0 {
		t.Fatalf("unexpected status response: %+v", response)
	}
}

func signedPolicyServer(t *testing.T) *Server {
	t.Helper()
	return &Server{
		cfg:   Config{GatewayHMACKey: []byte("12345678901234567890123456789012")},
		redis: &fakeSTSRedis{setNX: true},
		opa:   newOPAEngine(nil),
		log:   zerolog.Nop(),
	}
}

func signedSTSRequest(t *testing.T, server *Server, method, path string, body []byte, requestID string) *http.Request {
	t.Helper()
	var reader *bytes.Reader
	if body == nil {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader(body)
	}
	req := httptest.NewRequest(method, path, reader)
	timestamp := time.Now().UTC()
	req.Header.Set(corests.GatewayTimestampHeader, formatGatewayTimestamp(timestamp))
	req.Header.Set(corests.GatewayRequestHeader, requestID)
	req.Header.Set(corests.GatewaySignatureHeader, corests.SignGatewayExchange(server.cfg.GatewayHMACKey, timestamp, requestID, method, path, body))
	return req
}

func formatGatewayTimestamp(ts time.Time) string {
	return strconv.FormatInt(ts.Unix(), 10)
}
