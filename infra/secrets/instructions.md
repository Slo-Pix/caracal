# caracal/secrets

## Scope
- Covers only the secret-file layout consumed by the Caracal compose stack and
  Kubernetes manifests under `caracal/infra/`.

## Required
- Must generate dev secrets via `pnpm secrets:init`; output lands in `files/`.
- Must keep the `files/` directory gitignored at all times.
- Must use cryptographically random hex strings for every key/password (Node's `crypto.randomBytes`).
- Must use 0400 permissions on every generated secret file (POSIX only; Windows inherits NTFS ACLs).
- Production deployments must source secrets from an external manager
  (Vault, AWS Secrets Manager, GCP Secret Manager, or Kubernetes Secrets) and
  mount them at the same paths the dev stack uses.

## Forbidden
- Must not commit the contents of `files/` to git.
- Must not bake secrets into images.
- Must not log or echo secret material from any script in this directory.
