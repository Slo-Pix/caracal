/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the Control API route.
*/
import { createFileRoute, Link } from "@tanstack/react-router";

import { ModuleNotice } from "@/components/console/ModuleNotice";

export const Route = createFileRoute("/app/control")({
  component: ControlPage,
});

function ControlPage() {
  return (
    <ModuleNotice
      title="Control API"
      description="Programmatic, scoped automation of zone management."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Control API" }]}
      noticeTitle="Control keys are issued locally by design"
    >
      <p>
        For security, Control API keys are issued only from the local Caracal console running on an
        interactive terminal. This keeps the one-time key secret on the operator's machine and out
        of any browser session.
      </p>
      <p>
        Once issued, automation exchanges the key for short-lived, least-privilege STS tokens scoped
        as <span className="font-mono text-foreground">control:&lt;noun&gt;:&lt;verb&gt;</span> and
        calls the Control API directly. The web console intentionally does not mint or display these
        secrets.
      </p>
      <p>
        Applications and their traits for this zone remain visible under{" "}
        <Link to="/app/applications" className="font-medium text-foreground underline">
          Applications
        </Link>
        .
      </p>
    </ModuleNotice>
  );
}
