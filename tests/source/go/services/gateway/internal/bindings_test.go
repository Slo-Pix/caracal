// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Unit tests for Gateway binding cache revision behavior.

package internal

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
)

type bindingQuery struct {
	sql  string
	rows pgx.Rows
	err  error
}

type fakeBindingPool struct {
	t       *testing.T
	queries []bindingQuery
	calls   int
}

func (p *fakeBindingPool) Query(_ context.Context, sql string, _ ...any) (pgx.Rows, error) {
	p.t.Helper()
	if p.calls >= len(p.queries) {
		p.t.Fatalf("unexpected query: %s", sql)
	}
	q := p.queries[p.calls]
	p.calls++
	if q.sql != "" && q.sql != sql {
		p.t.Fatalf("query %d = %q want %q", p.calls, sql, q.sql)
	}
	return q.rows, q.err
}

type fakeRows struct {
	values [][]any
	index  int
	err    error
}

func (r *fakeRows) Close() {}
func (r *fakeRows) Err() error {
	return r.err
}
func (r *fakeRows) CommandTag() pgconn.CommandTag {
	return pgconn.CommandTag{}
}
func (r *fakeRows) FieldDescriptions() []pgconn.FieldDescription {
	return nil
}
func (r *fakeRows) Next() bool {
	if r.index >= len(r.values) {
		return false
	}
	r.index++
	return true
}
func (r *fakeRows) Scan(dest ...any) error {
	row := r.values[r.index-1]
	if len(dest) != len(row) {
		return errors.New("scan destination count mismatch")
	}
	for i, value := range row {
		switch d := dest[i].(type) {
		case *string:
			*d = value.(string)
		case *int64:
			*d = value.(int64)
		default:
			return errors.New("unsupported scan destination")
		}
	}
	return nil
}
func (r *fakeRows) Values() ([]any, error) {
	return r.values[r.index-1], nil
}
func (r *fakeRows) RawValues() [][]byte {
	return nil
}
func (r *fakeRows) Conn() *pgx.Conn {
	return nil
}

func TestBindingReloadIfChangedSkipsFullReloadWhenRevisionStable(t *testing.T) {
	store := newTestBindingStore(&fakeBindingPool{
		t: t,
		queries: []bindingQuery{
			{sql: "SELECT version FROM gateway_binding_revision WHERE id = true", rows: rowValues([]any{int64(4)})},
			{sql: "SELECT resource_identifier, zone_id, application_id FROM gateway_resource_bindings", rows: rowValues([]any{"resource://api", "z1", "app-1"})},
			{sql: "SELECT version FROM gateway_binding_revision WHERE id = true", rows: rowValues([]any{int64(4)})},
		},
	})
	if err := store.Reload(context.Background()); err != nil {
		t.Fatalf("Reload: %v", err)
	}

	pool := &fakeBindingPool{
		t: t,
		queries: []bindingQuery{
			{sql: "SELECT version FROM gateway_binding_revision WHERE id = true", rows: rowValues([]any{int64(4)})},
		},
	}
	store.pool = pool
	if err := store.ReloadIfChanged(context.Background()); err != nil {
		t.Fatalf("ReloadIfChanged: %v", err)
	}
	if pool.calls != 1 {
		t.Fatalf("ReloadIfChanged ran %d queries, want revision-only check", pool.calls)
	}
}

func TestBindingReloadIfChangedLoadsNewRevision(t *testing.T) {
	store := newTestBindingStore(&fakeBindingPool{
		t: t,
		queries: []bindingQuery{
			{sql: "SELECT version FROM gateway_binding_revision WHERE id = true", rows: rowValues([]any{int64(7)})},
			{sql: "SELECT resource_identifier, zone_id, application_id FROM gateway_resource_bindings", rows: rowValues([]any{"resource://api", "z1", "app-1"})},
			{sql: "SELECT version FROM gateway_binding_revision WHERE id = true", rows: rowValues([]any{int64(7)})},
		},
	})
	if err := store.ReloadIfChanged(context.Background()); err != nil {
		t.Fatalf("ReloadIfChanged: %v", err)
	}
	if store.revision.Load() != 7 {
		t.Fatalf("revision = %d want 7", store.revision.Load())
	}
	b, ok := store.Get("z1", "resource://api")
	if !ok || b.ApplicationID != "app-1" {
		t.Fatalf("binding not loaded: %+v ok=%v", b, ok)
	}
}

func TestNewBindingStoreStartsWithEmptyCache(t *testing.T) {
	store := newBindingStore(nil, zerolog.Nop())
	if store.Size() != 0 {
		t.Fatalf("new store size = %d", store.Size())
	}
	if _, ok := store.Get("zone", "resource"); ok {
		t.Fatal("new store should not contain bindings")
	}
}

func TestBindingStartPollingReturnsWhenContextCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	store := newTestBindingStore(&fakeBindingPool{t: t})
	store.StartPolling(ctx)
}

func newTestBindingStore(pool bindingQuerier) *bindingStore {
	s := &bindingStore{pool: pool, log: zerolog.Nop(), pollInterval: defaultBindingPollInterval}
	empty := map[string]binding{}
	s.cache.Store(&empty)
	return s
}

func rowValues(rows ...[]any) pgx.Rows {
	return &fakeRows{values: rows}
}
