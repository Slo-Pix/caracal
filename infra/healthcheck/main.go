// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Static HTTP probe used by container HEALTHCHECK directives.
// HEALTH_PATH selects between /ready (readiness, default) and /live (liveness);
// the binary returns non-zero on any non-2xx/3xx response or transport error.
package main

import (
	"net"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	path := os.Getenv("HEALTH_PATH")
	if path == "" {
		path = "/ready"
	}
	host := os.Getenv("HEALTH_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	timeout := 2 * time.Second
	if v := os.Getenv("HEALTH_TIMEOUT_MS"); v != "" {
		if d, err := time.ParseDuration(v + "ms"); err == nil && d > 0 {
			timeout = d
		}
	}
	client := &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DisableKeepAlives: true,
			DialContext: (&net.Dialer{
				Timeout: timeout / 2,
			}).DialContext,
		},
	}
	resp, err := client.Get("http://" + host + ":" + port + path)
	if err != nil {
		os.Exit(1)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		os.Exit(1)
	}
}
