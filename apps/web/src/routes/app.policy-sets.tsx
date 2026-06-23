/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Policy Sets route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/policy-sets")({
  component: PolicySetsPage,
});

function PolicySetsPage() {
  return (
    <ModulePlaceholder
      title="Policy Sets"
      description="Versioned bundles of policies, activated per zone."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Policy Sets" }]}
      emptyTitle="No policy sets yet"
      emptyDescription="Compose policies into a set, then activate a version to enforce it."
    />
  );
}
