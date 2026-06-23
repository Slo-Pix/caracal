/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Policy Sets route.
*/
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import { Badge, Card, EmptyState, SectionTitle, Tabs } from "@/components/ui";

export const Route = createFileRoute("/app/policy-sets")({
  component: PolicySetsPage,
});

function PolicySetsPage() {
  const [tab, setTab] = useState("overview");
  return (
    <ModulePage
      title="Policy Sets"
      description="Compose and activate policy sets."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Policy Sets" }]}
      actions={<Badge tone="muted">UI in progress</Badge>}
    >
      <div className="mb-5">
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "activity", label: "Activity" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "overview" ? (
        <Card>
          <SectionTitle>Planned capabilities</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2.5">
            <li className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>Create policy sets and versions</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>Activate a version with optional shadow</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>Simulate decisions against input fixtures</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>Track the active policy set</span>
            </li>{" "}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            These mirror the terminal Console and connect to the Control API in a later step.
          </p>
        </Card>
      ) : (
        <EmptyState
          title="No activity yet"
          description="Activity for this module appears here once it is connected to the Control API."
        />
      )}
    </ModulePage>
  );
}
