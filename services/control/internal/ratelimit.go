// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Per-subject token-bucket limiter for the control invoke endpoint with idle-bucket eviction.

package internal

import (
	"sync"
	"time"
)

type bucket struct {
	tokens float64
	last   time.Time
}

type RateLimiter struct {
	mu       sync.Mutex
	buckets  map[string]*bucket
	capacity float64
	window   time.Duration
	idle     time.Duration
	maxKeys  int
}

func NewRateLimiter(capacity int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		buckets:  map[string]*bucket{},
		capacity: float64(capacity),
		window:   window,
		idle:     10 * window,
		maxKeys:  10_000,
	}
}

func (r *RateLimiter) Allow(subject string) bool {
	if subject == "" {
		return false
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	r.evict(now)
	b, ok := r.buckets[subject]
	if !ok {
		if len(r.buckets) >= r.maxKeys {
			return false
		}
		b = &bucket{tokens: r.capacity - 1, last: now}
		r.buckets[subject] = b
		return true
	}
	elapsed := now.Sub(b.last).Seconds()
	refill := elapsed * (r.capacity / r.window.Seconds())
	b.tokens = minF(r.capacity, b.tokens+refill)
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func (r *RateLimiter) evict(now time.Time) {
	for k, b := range r.buckets {
		if now.Sub(b.last) > r.idle {
			delete(r.buckets, k)
		}
	}
}

func minF(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
