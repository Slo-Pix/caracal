// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Prometheus text exposition renderer for shared runtime metrics.

package metrics

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

const ContentType = "text/plain; version=0.0.4; charset=utf-8"

type MetricType string

const (
	Counter MetricType = "counter"
	Gauge   MetricType = "gauge"
)

type Sample struct {
	Name   string
	Help   string
	Type   MetricType
	Value  float64
	Labels map[string]string
}

func Render(samples []Sample) string {
	var b strings.Builder
	for _, sample := range samples {
		b.WriteString("# HELP ")
		b.WriteString(sample.Name)
		b.WriteByte(' ')
		b.WriteString(escapeHelp(sample.Help))
		b.WriteByte('\n')
		b.WriteString("# TYPE ")
		b.WriteString(sample.Name)
		b.WriteByte(' ')
		b.WriteString(string(sample.Type))
		b.WriteByte('\n')
		b.WriteString(sample.Name)
		if len(sample.Labels) > 0 {
			b.WriteString(renderLabels(sample.Labels))
		}
		b.WriteByte(' ')
		b.WriteString(strconv.FormatFloat(sample.Value, 'f', -1, 64))
		b.WriteByte('\n')
	}
	return b.String()
}

func renderLabels(labels map[string]string) string {
	keys := make([]string, 0, len(labels))
	for key := range labels {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf(`%s="%s"`, key, escapeLabel(labels[key])))
	}
	return "{" + strings.Join(parts, ",") + "}"
}

func escapeHelp(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	return strings.ReplaceAll(value, "\n", `\n`)
}

func escapeLabel(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, "\n", `\n`)
	return strings.ReplaceAll(value, `"`, `\"`)
}
