module github.com/garudex-labs/caracal/sts

go 1.26

require (
	github.com/garudex-labs/caracal/shared v0.0.0
	github.com/golang-jwt/jwt/v5 v5.2.1
	github.com/google/uuid v1.6.0
	github.com/jackc/pgx/v5 v5.7.4
	github.com/open-policy-agent/opa v1.4.0
	github.com/redis/go-redis/v9 v9.7.3
	github.com/rs/zerolog v1.33.0
	golang.org/x/crypto v0.37.0
)

replace github.com/garudex-labs/caracal/shared => ../../packages/shared
