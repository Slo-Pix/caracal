/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file renders a full-page error for any status code.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ErrorState } from "@/components/ErrorState";
import { errorEntry } from "@/platform/errors/catalog";

export const Route = createFileRoute("/error/$code")({
  head: ({ params }) => {
    const code = Number(params.code);
    const entry = errorEntry(code);
    return { meta: [{ title: `${code}: ${entry.title} · Caracal` }] };
  },
  component: ErrorByCodePage,
});

function ErrorByCodePage() {
  const { code } = Route.useParams();
  const parsed = Number(code);
  const normalized = Number.isInteger(parsed) && parsed >= 100 && parsed <= 599 ? parsed : 500;
  return <ErrorState code={normalized} />;
}
