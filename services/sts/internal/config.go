// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// STS-specific configuration loaded from environment.

package internal

import "github.com/garudex-labs/caracal/shared/config"

type Config struct {
	config.Base
	ZoneKEKProvider string
	IssuerURL       string
}

func loadConfig() Config {
	return Config{
		Base:            config.Load(),
		ZoneKEKProvider: config.Getenv("ZONE_KEK_PROVIDER", "local"),
		IssuerURL:       config.MustGetenv("ISSUER_URL"),
	}
}
