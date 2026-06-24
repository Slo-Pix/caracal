/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file wires the in-app guided setup: an element-anchored checklist driven by live zone state.
*/
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { InteractiveOnboardingChecklist, type Step } from "@/components/ui";
import {
  useActiveZone,
  useApplications,
  usePolicySets,
  useProviders,
  useResources,
} from "@/platform/api/hooks";
import { getGuidedSetup, setGuidedSetup, type GuidedSetupRecord } from "@/platform/state/localInstall";

interface SetupStep extends Step {
  to: string;
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Drives the guided checklist from the active zone's real inventory. Each step spotlights
// the matching sidebar entry and completes only when the backend shows the work is done,
// so the checklist reflects true setup progress rather than optimistic clicks.
export function GuidedSetup() {
  const navigate = useNavigate();
  const { activeZone } = useActiveZone();
  const zoneId = activeZone?.id ?? null;

  const applications = useApplications(zoneId);
  const resources = useResources(zoneId);
  const providers = useProviders(zoneId);
  const policySets = usePolicySets(zoneId);

  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const steps: SetupStep[] = useMemo(() => {
    const hasApps = (applications.data?.length ?? 0) > 0;
    const hasResources = (resources.data?.length ?? 0) > 0;
    const hasProviders = (providers.data?.length ?? 0) > 0;
    const hasActivePolicy = (policySets.data ?? []).some((set) => set.active_version_id);
    return [
      {
        id: "application",
        title: "Register an application",
        description: "Create a managed application identity that can request tokens in this zone.",
        targetSelector: '[data-tour="nav-applications"]',
        to: "/app/applications",
        actionLabel: "Open Applications",
        completed: hasApps,
      },
      {
        id: "provider",
        title: "Connect a provider",
        description: "Add an upstream identity or credential provider for this zone to broker.",
        targetSelector: '[data-tour="nav-providers"]',
        to: "/app/providers",
        actionLabel: "Open Providers",
        completed: hasProviders,
      },
      {
        id: "resource",
        title: "Define a resource",
        description: "Describe a protected resource and the scopes agents can be granted on it.",
        targetSelector: '[data-tour="nav-resources"]',
        to: "/app/resources",
        actionLabel: "Open Resources",
        completed: hasResources,
      },
      {
        id: "policy",
        title: "Activate a policy set",
        description:
          "Author a policy and activate a policy set so the zone authorizes requests instead of denying all.",
        targetSelector: '[data-tour="nav-policies"]',
        to: "/app/policies",
        actionLabel: "Open Policies",
        completed: hasActivePolicy,
      },
    ];
  }, [applications.data, resources.data, providers.data, policySets.data]);

  const allComplete = steps.length > 0 && steps.every((s) => s.completed);

  // Decide the initial visibility once, after the persisted preference is read: open
  // automatically for a fresh operator who still has work to do; otherwise stay parked
  // behind the launcher unless they finished, in which case the launcher hides too.
  useEffect(() => {
    if (hydrated) return;
    const record = getGuidedSetup();
    if (!record.dismissed && !record.finished) setOpen(true);
    setHydrated(true);
  }, [hydrated]);

  // Persist completion so a returning operator who has already done everything is not
  // nagged by the launcher.
  useEffect(() => {
    if (!hydrated || !allComplete) return;
    const record = getGuidedSetup();
    if (!record.finished) setGuidedSetup({ dismissed: record.dismissed, finished: true });
  }, [hydrated, allComplete]);

  if (!zoneId || !hydrated) return null;

  const finished = getGuidedSetup().finished;
  if (finished && allComplete) return null;

  return (
    <>
      <InteractiveOnboardingChecklist
        steps={steps}
        open={open}
        manualCompletion={false}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            const record = getGuidedSetup();
            setGuidedSetup({ dismissed: true, finished: record.finished });
          }
        }}
        onActivateStep={(id) => {
          const step = steps.find((s) => s.id === id);
          if (step) navigate({ to: step.to });
        }}
        onFinish={() => setGuidedSetup({ dismissed: true, finished: true })}
      />

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open guided setup"
          className="group fixed bottom-4 right-4 z-[55] grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:shadow-xl"
        >
          <PlayIcon className="h-6 w-6" />
          {steps.some((s) => s.completed) && !allComplete ? (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-emerald-500 text-[10px] font-bold text-white">
              {steps.filter((s) => s.completed).length}
            </span>
          ) : null}
        </button>
      ) : null}
    </>
  );
}
