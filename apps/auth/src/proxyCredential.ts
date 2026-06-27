// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Chooses which admin credential the Console BFF presents on a proxied request, keeping the god token off the read path.

// The upstream credential a proxied request presents: the bearer to try first and, only when a
// safe fallback exists, a second bearer to retry with if the first is rejected as unrecognized.
export interface ProxyCredential {
  token: string
  fallbackToken?: string
}

// Decides the credential for one proxied console request. A read (GET or HEAD) presents the
// least-privilege read-only token and may fall back to the admin token if the read token is not
// recognized, so a not-yet-provisioned or rotated read token never makes a read fail closed. A
// write always presents the admin token with no fallback, because the read token is denied every
// mutating request at the API, so falling back to it could never help and offering it as a
// second attempt would only widen the surface. A read with no distinct read token configured
// presents the admin token directly, since there is nothing weaker to prefer.
export function selectProxyCredential(method: string, adminToken: string, readToken: string | undefined): ProxyCredential {
  const verb = method.toUpperCase()
  const isRead = verb === 'GET' || verb === 'HEAD'
  if (isRead && readToken && readToken !== adminToken) {
    return { token: readToken, fallbackToken: adminToken }
  }
  return { token: adminToken }
}

// Decides whether a rejected proxied request should be retried once with the fallback
// credential. A retry happens only on 401, which means the presented token was not recognized
// — the case a not-yet-provisioned or rotated read token produces. A 403 is a genuine
// authorization denial (the credential is valid but lacks the authority), so it is surfaced
// unchanged rather than retried under broader authority, which would mask a real policy
// outcome. With no distinct fallback there is nothing to retry with.
export function shouldRetryWithFallback(status: number, token: string, fallbackToken: string | undefined): boolean {
  return status === 401 && fallbackToken !== undefined && fallbackToken !== token
}
