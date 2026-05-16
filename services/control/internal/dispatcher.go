// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Allowlist dispatcher: validates incoming command/subcommand against the canonical catalog and forwards to upstream services.

package internal

import (
	"context"
	"errors"
	"fmt"

	"github.com/garudex-labs/caracal/core/commands"
)

type Request struct {
	Command    string         `json:"command"`
	Subcommand string         `json:"subcommand"`
	Flags      map[string]any `json:"flags,omitempty"`
}

type Response struct {
	OK     bool   `json:"ok"`
	Result any    `json:"result,omitempty"`
	Error  string `json:"error,omitempty"`
}

// ErrDenied is returned when the requested command is not in the allowlist.
var ErrDenied = errors.New("denied")

// ErrUnsupported is returned when a command is allowlisted but no upstream binding exists yet.
var ErrUnsupported = errors.New("unsupported")

type Dispatcher struct {
	upstream map[string]Upstream
}

// Upstream translates an allowlisted command/subcommand pair into an external call.
// Implementations must be idempotent for read-only verbs and audit-emit on side effects.
type Upstream func(ctx context.Context, sub string, flags map[string]any) (any, error)

func NewDispatcher() *Dispatcher {
	return &Dispatcher{upstream: map[string]Upstream{}}
}

// Register binds a canonical command name to an upstream implementation.
func (d *Dispatcher) Register(name string, u Upstream) {
	d.upstream[name] = u
}

// Dispatch validates the request against the canonical allowlist and invokes the registered upstream.
// Validation rules: command must exist and not be hidden; subcommand must be present in the descriptor's list.
func (d *Dispatcher) Dispatch(ctx context.Context, req Request) (any, error) {
	desc := commands.ByName(req.Command)
	if desc == nil {
		return nil, fmt.Errorf("%w: command %q", ErrDenied, req.Command)
	}
	if !commands.HasSubcommand(req.Command, req.Subcommand) {
		return nil, fmt.Errorf("%w: subcommand %q not allowed for %q", ErrDenied, req.Subcommand, req.Command)
	}
	u, ok := d.upstream[req.Command]
	if !ok {
		return nil, fmt.Errorf("%w: %q has no registered upstream", ErrUnsupported, req.Command)
	}
	return u(ctx, req.Subcommand, req.Flags)
}
