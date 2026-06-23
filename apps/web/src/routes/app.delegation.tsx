/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Delegation route.
*/
import { createFileRoute, Link } from "@tanstack/react-router";

import { ModuleNotice } from "@/components/console/ModuleNotice";

export const Route = createFileRoute("/app/delegation")({
  component: DelegationPage,
});

function DelegationPage() {
  return (
    <ModuleNotice
      title="Delegation"
      description="The graph of delegated authority between agent sessions."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Delegation" }]}
      noticeTitle="Served by the Coordinator service"
    >
      <p>
        Delegation edges describe how authority flows between agent sessions. This graph is
        maintained by the Caracal Coordinator service. Connecting the Coordinator surfaces inbound
        and outbound delegation, traversal, impact analysis, and edge revocation here.
      </p>
      <p>
        Authority decisions for this zone are recorded under{" "}
        <Link to="/app/audit" className="font-medium text-foreground underline">
          Audit
        </Link>
        .
      </p>
    </ModuleNotice>
  );
}
