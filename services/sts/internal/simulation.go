// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Internal policy simulation endpoint for control-plane policy dry runs.

package internal

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	sharederr "github.com/garudex-labs/caracal/packages/core/go/errors"
	corests "github.com/garudex-labs/caracal/packages/core/go/sts"
)

type policySimulationRequest struct {
	PolicySetID string             `json:"policy_set_id"`
	VersionID   string             `json:"version_id"`
	ManifestSHA string             `json:"manifest_sha256"`
	Policies    []policyModuleJSON `json:"policies"`
	Input       OPAInput           `json:"input"`
}

type policyModuleJSON struct {
	ID      string `json:"id"`
	Content string `json:"content"`
}

type policySimulationResponse struct {
	PolicySetID string     `json:"policy_set_id"`
	VersionID   string     `json:"version_id"`
	ManifestSHA string     `json:"manifest_sha256"`
	Result      *OPAResult `json:"result"`
}

type policyStatusResponse struct {
	ZoneID             string `json:"zone_id"`
	Loaded             bool   `json:"loaded"`
	PolicySetVersionID string `json:"policy_set_version_id,omitempty"`
	ManifestSHA        string `json:"manifest_sha256,omitempty"`
	LoadedAt           string `json:"loaded_at,omitempty"`
	AgeSeconds         int64  `json:"age_seconds,omitempty"`
}

func (s *Server) handlePolicySimulation(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, sharederr.New(sharederr.InvalidToken, "malformed request body"))
		return
	}
	if err := s.verifySignedJSONRequest(r, body); err != nil {
		writeError(w, http.StatusUnauthorized, sharederr.New(sharederr.AccessDenied, "invalid simulation request signature"))
		return
	}
	var req policySimulationRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeError(w, http.StatusBadRequest, sharederr.New(sharederr.InvalidToken, "malformed json body"))
		return
	}
	if len(req.Policies) == 0 {
		writeError(w, http.StatusBadRequest, sharederr.New(sharederr.InvalidToken, "policy bundle is empty"))
		return
	}
	policies := make([]OPAPolicyModule, len(req.Policies))
	for i, policy := range req.Policies {
		policies[i] = OPAPolicyModule{ID: policy.ID, Content: policy.Content}
	}
	result, err := s.opa.Simulate(r.Context(), req.Input, policies)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, sharederr.New(sharederr.PolicyEvalFailed, err.Error()))
		return
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(policySimulationResponse{
		PolicySetID: req.PolicySetID,
		VersionID:   req.VersionID,
		ManifestSHA: req.ManifestSHA,
		Result:      result,
	}); err != nil {
		s.log.Warn().Err(err).Str("policy_set_id", req.PolicySetID).Str("version_id", req.VersionID).Msg("failed to encode policy simulation response")
	}
}

func (s *Server) handlePolicyStatus(w http.ResponseWriter, r *http.Request) {
	if err := s.verifySignedJSONRequest(r, nil); err != nil {
		writeError(w, http.StatusUnauthorized, sharederr.New(sharederr.AccessDenied, "invalid policy status request signature"))
		return
	}
	zoneID := r.PathValue("zoneID")
	if zoneID == "" {
		writeError(w, http.StatusBadRequest, sharederr.New(sharederr.ZoneInvalid, "zone_id required"))
		return
	}
	info := s.opa.BundleInfo(zoneID)
	response := policyStatusResponse{ZoneID: zoneID}
	if info.PolicySetVersionID != "" || info.ManifestSHA != "" {
		response.Loaded = true
		response.PolicySetVersionID = info.PolicySetVersionID
		response.ManifestSHA = info.ManifestSHA
		if !info.LoadedAt.IsZero() {
			response.LoadedAt = info.LoadedAt.UTC().Format(time.RFC3339)
			response.AgeSeconds = int64(time.Since(info.LoadedAt) / time.Second)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		s.log.Warn().Err(err).Str("zone", zoneID).Msg("failed to encode policy status response")
	}
}

func (s *Server) verifySignedJSONRequest(r *http.Request, body []byte) error {
	timestamp := r.Header.Get(corests.GatewayTimestampHeader)
	requestID := r.Header.Get(corests.GatewayRequestHeader)
	signature := r.Header.Get(corests.GatewaySignatureHeader)
	if err := corests.VerifyGatewayExchange(s.cfg.GatewayHMACKey, time.Now().UTC(), gatewayExchangeSkew, timestamp, requestID, signature, r.Method, r.URL.EscapedPath(), body); err != nil {
		return err
	}
	return s.consumeGatewayNonce(r.Context(), requestID)
}
