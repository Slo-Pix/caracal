// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// STS exchange client for the gateway.

package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	sharederr "github.com/garudex-labs/caracal/shared/errors"
)

type tokenResponse struct {
	AccessToken     string            `json:"access_token"`
	ExpiresIn       int               `json:"expires_in"`
	TargetUpstreams map[string]string `json:"target_upstreams"`
}

type stsClient struct {
	url    string
	client *http.Client
}

func newSTSClient(stsURL string) *stsClient {
	transport := &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 100,
		MaxConnsPerHost:     200,
		IdleConnTimeout:     90 * time.Second,
	}
	return &stsClient{
		url:    strings.TrimRight(stsURL, "/"),
		client: &http.Client{Timeout: 5 * time.Second, Transport: transport},
	}
}

// Exchange performs RFC 8693 token exchange against STS.
func (c *stsClient) Exchange(ctx context.Context, subjectToken, clientID, resource, requestID string) (string, string, int, *sharederr.CaracalError) {
	form := url.Values{
		"grant_type":         {"urn:ietf:params:oauth:grant-type:token-exchange"},
		"client_id":          {clientID},
		"subject_token":      {subjectToken},
		"subject_token_type": {"urn:ietf:params:oauth:token-type:access_token"},
		"resource":           {resource},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.url+"/oauth/2/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", "", http.StatusInternalServerError, sharederr.New(sharederr.STSUnavailable, err.Error())
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "caracal-gateway")
	if requestID != "" {
		req.Header.Set("X-Request-Id", requestID)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return "", "", http.StatusBadGateway, sharederr.New(sharederr.STSUnavailable, err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		var e sharederr.CaracalError
		if err := json.NewDecoder(resp.Body).Decode(&e); err != nil || e.Code == "" {
			return "", "", resp.StatusCode, sharederr.New(sharederr.STSUnavailable, resp.Status)
		}
		return "", "", resp.StatusCode, &e
	}
	var tr tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tr); err != nil {
		return "", "", http.StatusInternalServerError, sharederr.New(sharederr.Internal, err.Error())
	}
	if tr.AccessToken == "" {
		return "", "", http.StatusInternalServerError, sharederr.New(sharederr.Internal, fmt.Sprintf("empty access_token from STS"))
	}
	upstream := tr.TargetUpstreams[resource]
	if upstream == "" {
		return "", "", http.StatusForbidden, sharederr.New(sharederr.AccessDenied, "resource upstream not configured")
	}
	return tr.AccessToken, upstream, http.StatusOK, nil
}
