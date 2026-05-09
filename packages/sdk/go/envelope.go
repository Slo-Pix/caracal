// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Wire envelope constants and codec for transport-neutral identity propagation.

package sdk

import (
	"net/http"
	"strconv"
	"strings"
)

const (
	HeaderSubjectToken   = "caracal-subject-token"
	HeaderAgentSession   = "caracal-agent-session"
	HeaderDelegationEdge = "caracal-delegation-edge"
	HeaderParentEdge     = "caracal-parent-edge"
	HeaderTrace          = "caracal-trace"
	HeaderHop            = "caracal-hop"

	MaxHop = 32
)

// Envelope is the transport-neutral identity propagation payload.
type Envelope struct {
	SubjectToken    string
	AgentSessionID  string
	DelegationEdgeID string
	ParentEdgeID    string
	TraceID         string
	Hop             int
}

// FromHTTPRequest extracts an Envelope from an *http.Request.
func FromHTTPRequest(r *http.Request) Envelope {
	return DecodeEnvelope(func(name string) string {
		return r.Header.Get(name)
	})
}

// DecodeEnvelope reads envelope fields using the provided getter.
func DecodeEnvelope(get func(string) string) Envelope {
	hop := 0
	if raw := get(HeaderHop); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil {
			hop = max(0, min(MaxHop, n))
		}
	}
	return Envelope{
		SubjectToken:     get(HeaderSubjectToken),
		AgentSessionID:   get(HeaderAgentSession),
		DelegationEdgeID: get(HeaderDelegationEdge),
		ParentEdgeID:     get(HeaderParentEdge),
		TraceID:          get(HeaderTrace),
		Hop:              hop,
	}
}

// EncodeEnvelope writes envelope fields using the provided setter.
func EncodeEnvelope(env Envelope, set func(name, value string)) {
	if env.SubjectToken != "" {
		set(HeaderSubjectToken, env.SubjectToken)
	}
	if env.AgentSessionID != "" {
		set(HeaderAgentSession, env.AgentSessionID)
	}
	if env.DelegationEdgeID != "" {
		set(HeaderDelegationEdge, env.DelegationEdgeID)
	}
	if env.ParentEdgeID != "" {
		set(HeaderParentEdge, env.ParentEdgeID)
	}
	if env.TraceID != "" {
		set(HeaderTrace, env.TraceID)
	}
	set(HeaderHop, strconv.Itoa(env.Hop))
}

// InjectHTTP sets Caracal headers on an outbound http.Header.
func InjectHTTP(env Envelope, h http.Header) {
	EncodeEnvelope(env, func(name, value string) {
		h.Set(canonicalHeader(name), value)
	})
}

// ToMap serializes the envelope to a plain string map (for gRPC metadata,
// MCP _meta, queue headers, etc.).
func ToMap(env Envelope) map[string]string {
	out := make(map[string]string, 6)
	EncodeEnvelope(env, func(name, value string) {
		out[name] = value
	})
	return out
}

// FromMap deserializes an Envelope from a plain string map.
func FromMap(m map[string]string) Envelope {
	get := func(name string) string {
		lower := strings.ToLower(name)
		for k, v := range m {
			if strings.ToLower(k) == lower {
				return v
			}
		}
		return ""
	}
	return DecodeEnvelope(get)
}

func canonicalHeader(name string) string {
	return http.CanonicalHeaderKey(name)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
