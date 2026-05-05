module github.com/garudex-labs/caracal/gateway

go 1.26

require (
	github.com/garudex-labs/caracal/shared v0.0.0
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/rs/zerolog v1.33.0
)

replace github.com/garudex-labs/caracal/shared => ../../packages/shared
