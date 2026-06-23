/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Resources route.
*/
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import { Badge, Card, EmptyState, SectionTitle, Tabs } from "@/components/ui";

export const Route = createFileRoute("/app/resources")({
  component: ResourcesPage,
});

function ResourcesPage() {
  const [tab, setTab] = useState("overview");
  return (
    <ModulePage
      title="Resources"
      description="Manage protected resources and their operations."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Resources" }]}
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
              <span>Define resource identifiers and scopes</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>Configure upstream URLs and gateway routing</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>Declare authorized operations and enforcement</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>Patch and delete resources</span>
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
