// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Go module definition for the Redis revocation connector.

module github.com/garudex-labs/caracal/revocationredis

go 1.26

require (
	github.com/garudex-labs/caracal/core v0.0.0
	github.com/garudex-labs/caracal/revocation v0.0.0
	github.com/redis/go-redis/v9 v9.19.0
)

require (
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/stretchr/testify v1.11.1 // indirect
	go.uber.org/atomic v1.11.0 // indirect
	golang.org/x/crypto v0.51.0 // indirect
	golang.org/x/sys v0.44.0 // indirect
)

replace github.com/garudex-labs/caracal/core => ../../../core/go

replace github.com/garudex-labs/caracal/revocation => ../../../revocation/go
