// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// In-memory JTI replay cache for the control invoke endpoint: rejects a token id that has already been seen within its lifetime.

package internal

import (
	"sync"
	"time"
)

type ReplayCache struct {
	mu      sync.Mutex
	seen    map[string]time.Time
	ttl     time.Duration
	maxKeys int
}

func NewReplayCache(ttl time.Duration) *ReplayCache {
	return &ReplayCache{seen: map[string]time.Time{}, ttl: ttl, maxKeys: 100_000}
}

// Mark records jti and returns false if it has already been seen within ttl.
func (c *ReplayCache) Mark(jti string, exp time.Time) bool {
	if jti == "" {
		return true
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	c.evict(now)
	if _, ok := c.seen[jti]; ok {
		return false
	}
	if len(c.seen) >= c.maxKeys {
		return false
	}
	keepUntil := exp
	if keepUntil.IsZero() || keepUntil.After(now.Add(c.ttl)) {
		keepUntil = now.Add(c.ttl)
	}
	c.seen[jti] = keepUntil
	return true
}

func (c *ReplayCache) evict(now time.Time) {
	for k, t := range c.seen {
		if !t.After(now) {
			delete(c.seen, k)
		}
	}
}
