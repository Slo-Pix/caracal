/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file builds the type-safe client router for the SPA.
*/
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { ErrorState } from "./components/ErrorState";
import { routeTree } from "./routeTree.gen";

// Centralized data contract for every console query: cache briefly, never retry
// (the BFF returns structured errors that retrying cannot fix), and refresh on
// reconnect so the control plane recovers cleanly after a dropped connection.
export function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });
}

export const getRouter = () => {
  const queryClient = buildQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Route every not-found to the root error page rather than the default 'fuzzy' mode, which
    // renders the not-found at the nearest matched parent. A deep path like /app/<unknown> matches
    // the /app layout, which has no notFoundComponent, so fuzzy mode would show the framework's
    // bare "Not Found" inside the console shell. 'root' takes any unknown route to the branded
    // error page instead.
    notFoundMode: "root",
    // A safety net so a not-found ever resolved outside the root still renders the branded error
    // page rather than the framework's generic "Not Found".
    defaultNotFoundComponent: () => <ErrorState code={404} />,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
