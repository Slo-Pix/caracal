/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Agents route.
*/
import { createFileRoute, Link } from "@tanstack/react-router";

import { ModuleNotice } from "@/components/console/ModuleNotice";

export const Route = createFileRoute("/app/agents")({
  component: AgentsPage,
});

function AgentsPage() {
  return (
    <ModuleNotice
      title="Agents"
      description="Live agent sessions and their delegation lineage."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Agents" }]}
      noticeTitle="Served by the Coordinator service"
    >
      <p>
        Agent sessions and their lineage are managed by the Caracal Coordinator, a separate runtime
        service from the admin control plane. Connecting the Coordinator surfaces live agents,
        suspend/resume/terminate controls, and effective authority here.
      </p>
      <p>
        In the meantime, authenticated subject sessions for this zone are visible under{" "}
        <Link to="/app/sessions" className="font-medium text-foreground underline">
          Sessions
        </Link>
        .
      </p>
    </ModuleNotice>
  );
}
