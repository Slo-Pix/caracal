// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Revocation store contract for resource servers consulting caracal.sessions.revoke.

export interface RevocationStore {
  isRevoked: (sid: string) => boolean | Promise<boolean>
  markRevoked: (sid: string, ttlMs?: number) => void
}
