/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file exposes runtime configuration for the web client.
*/
const env = import.meta.env;

export const config = {
  authBaseUrl: (env.VITE_CARACAL_AUTH_URL as string | undefined) ?? "http://localhost:3002",
  docsUrl: "https://docs.caracal.run",
  enterpriseUrl: "https://caracal.run/enterprise",
};
