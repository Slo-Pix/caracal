// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Audit service configuration.

package internal

import "github.com/garudex-labs/caracal/shared/config"

type Config struct {
	config.Base
	S3Endpoint string
	S3Bucket   string
	S3Region   string
}

func loadConfig() Config {
	return Config{
		Base:       config.Load(),
		S3Endpoint: config.Getenv("AUDIT_EXPORT_S3_ENDPOINT", ""),
		S3Bucket:   config.Getenv("AUDIT_EXPORT_S3_BUCKET", ""),
		S3Region:   config.Getenv("AUDIT_EXPORT_S3_REGION", "us-east-1"),
	}
}
