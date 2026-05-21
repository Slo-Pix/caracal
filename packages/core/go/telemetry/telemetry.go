// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// OpenTelemetry bootstrap helpers for Go services.

package telemetry

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func Setup(ctx context.Context, serviceName string) (func(context.Context) error, error) {
	endpoint := strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT"))
	if endpoint == "" {
		otel.SetTextMapPropagator(propagation.TraceContext{})
		return func(context.Context) error { return nil }, nil
	}
	protocol := strings.TrimSpace(os.Getenv("OTEL_EXPORTER_OTLP_PROTOCOL"))
	if protocol != "" && protocol != "http/protobuf" {
		return nil, fmt.Errorf("unsupported OTEL_EXPORTER_OTLP_PROTOCOL %q", protocol)
	}
	exporter, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpointURL(endpoint))
	if err != nil {
		return nil, err
	}
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(resource.NewSchemaless(resourceAttributes(serviceName)...)),
	)
	otel.SetTracerProvider(provider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(propagation.TraceContext{}, propagation.Baggage{}))
	return provider.Shutdown, nil
}

func HTTPHandler(operation string, next http.Handler) http.Handler {
	return otelhttp.NewHandler(next, operation)
}

func resourceAttributes(serviceName string) []attribute.KeyValue {
	attrs := []attribute.KeyValue{attribute.String("service.name", serviceName)}
	for _, raw := range strings.Split(os.Getenv("OTEL_RESOURCE_ATTRIBUTES"), ",") {
		key, value, ok := strings.Cut(strings.TrimSpace(raw), "=")
		if !ok || strings.TrimSpace(key) == "" {
			continue
		}
		attrs = append(attrs, attribute.String(strings.TrimSpace(key), strings.TrimSpace(value)))
	}
	return attrs
}
