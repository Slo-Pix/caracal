// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Lightweight runtime metrics for STS hot-path observability.

package internal

import "sync/atomic"

type STSMetrics struct {
	GraphTraversals      atomic.Uint64
	GraphTraversalErrors atomic.Uint64
}

type STSMetricsSnapshot struct {
	GraphTraversals      uint64 `json:"graph_traversals"`
	GraphTraversalErrors uint64 `json:"graph_traversal_errors"`
}

func (m *STSMetrics) Snapshot() STSMetricsSnapshot {
	return STSMetricsSnapshot{
		GraphTraversals:      m.GraphTraversals.Load(),
		GraphTraversalErrors: m.GraphTraversalErrors.Load(),
	}
}
