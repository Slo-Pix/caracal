// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Audit emit sink for the control surface: every invoke decision is logged to caracal.audit.events as a control.invoke event.

package internal

import (
	"context"
	"encoding/json"
	"time"

	"github.com/rs/zerolog"
)

type AuditEvent struct {
	At        time.Time `json:"at"`
	Subject   string    `json:"subject"`
	JTI       string    `json:"jti"`
	Command   string    `json:"command"`
	Sub       string    `json:"subcommand,omitempty"`
	Decision  string    `json:"decision"`
	Reason    string    `json:"reason,omitempty"`
	RequestID string    `json:"request_id,omitempty"`
}

type EventSink interface {
	Emit(ev AuditEvent)
}

// logSink writes structured audit events to stderr via the standard logger.
// Redis-backed delivery is wired by replacing this with packages/core/go/audit.Client at deploy time.
type logSink struct{ log zerolog.Logger }

func (s *logSink) Emit(ev AuditEvent) {
	b, _ := json.Marshal(ev)
	s.log.Info().RawJSON("event", b).Str("stream", "caracal.audit.events").Str("type", "control.invoke").Msg("audit")
}

func NewEventSink(_ context.Context, log zerolog.Logger) (EventSink, error) {
	return &logSink{log: log}, nil
}
