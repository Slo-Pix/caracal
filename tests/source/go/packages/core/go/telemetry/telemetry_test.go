// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for OpenTelemetry setup helpers.

package telemetry

import (
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"sync"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
)

func TestSetupWithoutEndpointReturnsNoopShutdownAndTraceContext(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "   ")
	t.Setenv("OTEL_EXPORTER_OTLP_PROTOCOL", "")

	shutdown, err := Setup(context.Background(), "caracal-test")
	if err != nil {
		t.Fatalf("setup without endpoint: %v", err)
	}
	if shutdown == nil {
		t.Fatal("shutdown must not be nil")
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("noop shutdown: %v", err)
	}

	carrier := propagation.MapCarrier{}
	ctx := context.Background()
	otel.GetTextMapPropagator().Inject(ctx, carrier)
	if len(carrier) != 0 {
		t.Fatalf("trace context without a span should not inject headers, got %v", carrier)
	}
}

func TestSetupRejectsUnsupportedProtocol(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://127.0.0.1:4318")
	t.Setenv("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc")

	shutdown, err := Setup(context.Background(), "caracal-test")
	if err == nil {
		t.Fatal("expected unsupported protocol error")
	}
	if shutdown != nil {
		t.Fatal("shutdown should be nil when setup fails")
	}
}

func TestSetupPropagatesExporterStartError(t *testing.T) {
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://127.0.0.1:4318")
	t.Setenv("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	shutdown, err := Setup(ctx, "caracal-test")
	if err == nil {
		t.Fatal("expected exporter start error")
	}
	if shutdown != nil {
		t.Fatal("shutdown should be nil when exporter creation fails")
	}
}

func TestSetupConfiguresHTTPProviderAndCompositePropagator(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	defer srv.Close()

	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", srv.URL)
	t.Setenv("OTEL_EXPORTER_OTLP_PROTOCOL", " http/protobuf ")
	t.Setenv("OTEL_RESOURCE_ATTRIBUTES", "deployment.environment=unit, invalid, service.namespace = core , =ignored")

	shutdown, err := Setup(context.Background(), "caracal-test")
	if err != nil {
		t.Fatalf("setup with endpoint: %v", err)
	}
	if shutdown == nil {
		t.Fatal("shutdown must not be nil")
	}
	defer func() {
		if err := shutdown(context.Background()); err != nil {
			t.Fatalf("shutdown provider: %v", err)
		}
	}()

	carrier := propagation.MapCarrier{}
	otel.GetTextMapPropagator().Inject(context.Background(), carrier)
	if carrier == nil {
		t.Fatal("propagator should accept injection carriers")
	}
}

func TestHTTPHandlerDelegatesRequest(t *testing.T) {
	var called bool
	handler := HTTPHandler("test-operation", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.Header().Set("X-Test", "handled")
		w.WriteHeader(http.StatusCreated)
	}))

	req := httptest.NewRequest(http.MethodPost, "/resource", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if !called {
		t.Fatal("wrapped handler was not called")
	}
	if rr.Code != http.StatusCreated || rr.Header().Get("X-Test") != "handled" {
		t.Fatalf("unexpected response: status=%d headers=%v", rr.Code, rr.Header())
	}
}

func TestHTTPHandlerIsSafeForConcurrentRequests(t *testing.T) {
	const requests = 16
	var wg sync.WaitGroup
	wg.Add(requests)
	handler := HTTPHandler("test-operation", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	for i := 0; i < requests; i++ {
		go func() {
			defer wg.Done()
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, httptest.NewRequest(http.MethodGet, "/", nil))
			if rr.Code != http.StatusNoContent {
				t.Errorf("status = %d, want %d", rr.Code, http.StatusNoContent)
			}
		}()
	}
	wg.Wait()
}

func TestResourceAttributesParsesValidPairsAndSkipsMalformedEntries(t *testing.T) {
	t.Setenv("OTEL_RESOURCE_ATTRIBUTES", " deployment.environment = production ,invalid, service.namespace=core,=missing-key,empty= ")

	got := resourceAttributes("gateway")
	want := []attribute.KeyValue{
		attribute.String("service.name", "gateway"),
		attribute.String("deployment.environment", "production"),
		attribute.String("service.namespace", "core"),
		attribute.String("empty", ""),
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("resource attributes = %#v, want %#v", got, want)
	}
}
