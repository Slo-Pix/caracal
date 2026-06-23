/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Delegation route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePlaceholder } from "@/components/console/ModulePlaceholder";

export const Route = createFileRoute("/app/delegation")({
  component: DelegationPage,
});

function DelegationPage() {
  return (
    <ModulePlaceholder
      title="Delegation"
      description="The graph of delegated authority between sessions."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Delegation" }]}
      emptyTitle="No delegation edges"
      emptyDescription="Delegated authority between agent sessions is mapped here as a graph."
    />
  );
}
