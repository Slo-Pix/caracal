// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Tests for Prometheus text exposition rendering.

package metrics

import (
	"strings"
	"testing"
)

func TestRenderEscapesLabelsAndHelp(t *testing.T) {
	body := Render([]Sample{{
		Name:  "caracal_test_total",
		Help:  "line one\nline two",
		Type:  Counter,
		Value: 3,
		Labels: map[string]string{
			"b": "quote\"value",
			"a": "slash\\value",
		},
	}})
	if !strings.Contains(body, "# HELP caracal_test_total line one\\nline two\n") {
		t.Fatalf("help line not escaped: %q", body)
	}
	if !strings.Contains(body, `caracal_test_total{a="slash\\value",b="quote\"value"} 3`) {
		t.Fatalf("labels not escaped or sorted: %q", body)
	}
}
