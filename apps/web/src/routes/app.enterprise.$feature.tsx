/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the locked enterprise capability route.
*/
import { createFileRoute } from "@tanstack/react-router";

import { ModulePage } from "@/components/console/ModulePage";
import { Button, Card, LockBadge, SectionTitle } from "@/components/ui";
import { config } from "@/platform/config";
import { LOCKED_FEATURES } from "@/platform/edition/lockedFeatures";

export const Route = createFileRoute("/app/enterprise/$feature")({
  component: LockedFeaturePage,
});

function LockedFeaturePage() {
  const { feature } = Route.useParams();
  const data = LOCKED_FEATURES[feature];

  if (!data) {
    return (
      <ModulePage title="Enterprise" description="This capability is part of Caracal Enterprise.">
        <Card>
          <p className="text-sm text-muted-foreground">Learn more about Caracal Enterprise.</p>
          <a
            className="mt-3 inline-block"
            href={config.enterpriseUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Button>Explore Enterprise</Button>
          </a>
        </Card>
      </ModulePage>
    );
  }

  return (
    <ModulePage
      title={data.title}
      description={data.summary}
      breadcrumbs={[
        { label: "Console", to: "/app" },
        { label: "Enterprise" },
        { label: data.title },
      ]}
      actions={<LockBadge />}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle>What you get</SectionTitle>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-foreground">
            {data.value.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span className="mt-1 text-muted-foreground">·</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-3">
            <a href={config.enterpriseUrl} target="_blank" rel="noreferrer">
              <Button>Upgrade to Enterprise</Button>
            </a>
            <a
              href={config.enterpriseUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Learn more at caracal.run
            </a>
          </div>
        </Card>

        <Card>
          <SectionTitle>Preview</SectionTitle>
          <div className="mt-3 grid h-44 place-items-center rounded-md border border-dashed border-border bg-muted/40 text-center">
            <div className="px-4">
              <LockBadge />
              <p className="mt-2 text-xs text-muted-foreground">
                {data.title} is available in Caracal Enterprise.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </ModulePage>
  );
}
