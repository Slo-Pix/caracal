// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Resolves which authentication providers are configured for this installation.

import type { AuthConfig } from "./config.ts";

export interface SocialProviderCredentials {
  clientId: string;
  clientSecret: string;
}

export interface EnabledProviders {
  email: boolean;
  google: boolean;
  github: boolean;
}

export function googleCredentials(): SocialProviderCredentials | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function githubCredentials(): SocialProviderCredentials | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function enabledProviders(_cfg: AuthConfig): EnabledProviders {
  return {
    email: true,
    google: googleCredentials() !== null,
    github: githubCredentials() !== null,
  };
}
