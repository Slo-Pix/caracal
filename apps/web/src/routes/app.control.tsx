/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Control API route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/control")({
  component: ControlPage,
});

function ControlPage() {
  return (
    <ModulePlaceholder
      title="Control API"
      description="Programmatic keys and tokens for automating this zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Control API" }]}
      emptyTitle="No Control keys yet"
      emptyDescription="Issue a scoped Control API key to automate zone management."
    />
  );
}
