// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Gateway exchange authentication helpers shared by STS and Gateway.

package sts

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"time"
)

const (
	GatewayTimestampHeader = "X-Caracal-Gateway-Timestamp"
	GatewayRequestHeader   = "X-Caracal-Gateway-Request"
	GatewaySignatureHeader = "X-Caracal-Gateway-Signature"
)

func SignGatewayExchange(key []byte, timestamp time.Time, requestID string, body []byte) string {
	if len(key) == 0 {
		return ""
	}
	mac := hmac.New(sha256.New, key)
	mac.Write(gatewayExchangePayload(timestamp.Unix(), requestID, body))
	return hex.EncodeToString(mac.Sum(nil))
}

func VerifyGatewayExchange(key []byte, now time.Time, maxSkew time.Duration, timestamp, requestID, signature string, body []byte) error {
	if len(key) == 0 {
		return errors.New("gateway exchange key not configured")
	}
	if timestamp == "" || requestID == "" || signature == "" {
		return errors.New("gateway exchange signature headers missing")
	}
	unix, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return errors.New("gateway exchange timestamp invalid")
	}
	ts := time.Unix(unix, 0)
	if now.Sub(ts) > maxSkew || ts.Sub(now) > maxSkew {
		return errors.New("gateway exchange timestamp outside skew")
	}
	got, err := hex.DecodeString(signature)
	if err != nil {
		return errors.New("gateway exchange signature invalid")
	}
	mac := hmac.New(sha256.New, key)
	mac.Write(gatewayExchangePayload(unix, requestID, body))
	if !hmac.Equal(got, mac.Sum(nil)) {
		return errors.New("gateway exchange signature mismatch")
	}
	return nil
}

func gatewayExchangePayload(timestamp int64, requestID string, body []byte) []byte {
	digest := sha256.Sum256(body)
	return []byte(fmt.Sprintf("%d\n%s\n%x", timestamp, requestID, digest))
}
