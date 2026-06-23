/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the settings route.
*/
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import { Button, Card, Field, SectionTitle, Tabs, useToast } from "@/components/ui";
import { signOut, useSession } from "@/platform/auth";
import { getInstallation, setInstallation } from "@/platform/state/localInstall";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSession();
  const [tab, setTab] = useState("installation");
  const [name, setName] = useState(() => getInstallation().name);
  const [saving, setSaving] = useState(false);

  function saveInstallation() {
    setSaving(true);
    setInstallation({ ...getInstallation(), name: name.trim() || "Caracal" });
    setSaving(false);
    toast({ tone: "success", title: "Settings saved" });
  }

  return (
    <ModulePage
      title="Settings"
      description="Manage installation and account settings."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Settings" }]}
    >
      <div className="mb-5">
        <Tabs
          tabs={[
            { id: "installation", label: "Installation" },
            { id: "account", label: "Account" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "installation" ? (
        <Card className="max-w-xl">
          <SectionTitle>Installation</SectionTitle>
          <div className="mt-4 flex flex-col gap-4">
            <Field
              label="Installation name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              hint="Shown across the Console and audit trail."
            />
            <div>
              <Button onClick={saveInstallation} loading={saving}>
                Save changes
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="max-w-xl">
          <SectionTitle>Account</SectionTitle>
          <dl className="mt-4 divide-y divide-border text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-foreground">{session.data?.user?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-mono text-xs text-foreground">
                {session.data?.user?.email ?? "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={async () => {
                await signOut();
                navigate({ to: "/sign-in" });
              }}
            >
              Sign out
            </Button>
          </div>
        </Card>
      )}
    </ModulePage>
  );
}
