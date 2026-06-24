/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file defines the settings route.
*/
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import { EnterpriseUpsell } from "@/components/console/EnterpriseUpsell";
import {
  AvatarPicker,
  Badge,
  Button,
  Field,
  LockBadge,
  Modal,
  Skeleton,
  Tooltip,
  useToast,
} from "@/components/ui";
import { LOCKED_FEATURES } from "@/platform/edition/lockedFeatures";
import { consoleApi } from "@/platform/api/client";
import { useZones } from "@/platform/api/hooks";
import {
  AuthApiError,
  changePassword,
  deleteAccount,
  listSessions,
  revokeOtherSessions,
  signOut,
  updateUser,
  useSession,
} from "@/platform/auth";
import {
  clearLocalIdentity,
  getProfile,
  HANDLE_MAX,
  NAME_MAX,
  resolveDisplayName,
  sanitizeHandle,
  setProfile,
  useProfile,
} from "@/platform/state/localInstall";
import { setTheme, useTheme } from "@/platform/theme";

interface SettingsSection {
  id: string;
  label: string;
  description: string;
  featureSlug?: string;
}

interface SettingsNavGroup {
  id: string;
  label: string;
  items: SettingsSection[];
}

const SETTINGS_GROUPS: SettingsNavGroup[] = [
  {
    id: "account",
    label: "Account",
    items: [
      { id: "profile", label: "Profile", description: "Identity, avatar, and operator naming." },
      { id: "access", label: "Access", description: "Password and sign-in security." },
      { id: "sessions", label: "Sessions", description: "Authenticated devices and expiry." },
      { id: "preferences", label: "Preferences", description: "Theme defaults." },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    items: [
      {
        id: "sso",
        label: "SSO & Directory Sync",
        description: LOCKED_FEATURES.sso.summary,
        featureSlug: "sso",
      },
      {
        id: "members",
        label: "Members & Roles",
        description: LOCKED_FEATURES["teams-roles"].summary,
        featureSlug: "teams-roles",
      },
      {
        id: "organization",
        label: "Organization",
        description: LOCKED_FEATURES.organizations.summary,
        featureSlug: "organizations",
      },
      {
        id: "integrations",
        label: "Integrations",
        description: LOCKED_FEATURES.connectors.summary,
        featureSlug: "connectors",
      },
    ],
  },
  {
    id: "danger",
    label: "Danger zone",
    items: [
      {
        id: "lifecycle",
        label: "Account deletion",
        description: "Delete the authenticated account.",
      },
    ],
  },
];

const ALL_SECTIONS = SETTINGS_GROUPS.flatMap((group) => group.items);

type SectionId = string;

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [section, setSection] = useState<SectionId>("profile");
  const current = ALL_SECTIONS.find((item) => item.id === section) ?? ALL_SECTIONS[0];
  const feature = current.featureSlug ? LOCKED_FEATURES[current.featureSlug] : undefined;

  return (
    <ModulePage
      title="Settings"
      description="Account and administration controls."
      breadcrumbs={[{ label: "Console", to: "/app" }, { label: "Settings" }]}
    >
      <div className="grid gap-8 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <div className="border border-border bg-card">
            {SETTINGS_GROUPS.map((group) => (
              <div key={group.id} className="border-b border-border last:border-b-0">
                <div className="px-4 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </div>
                <nav className="grid">
                  {group.items.map((item) => {
                    const active = item.id === section;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setSection(item.id)}
                        className={[
                          "flex items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors",
                          active
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-surface hover:text-foreground",
                        ].join(" ")}
                      >
                        <span className="text-sm font-semibold">{item.label}</span>
                        {item.featureSlug ? (
                          <span className={active ? "opacity-80" : ""}>
                            <LockBadge />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 border-y border-border">
          <div className="border-b border-border py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {current.label}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                {current.label}
              </h2>
              {feature ? <LockBadge /> : <HelpTip label={current.description} />}
            </div>
          </div>

          <div>
            {section === "profile" ? <ProfileSection /> : null}
            {section === "access" ? <AccessSection /> : null}
            {section === "sessions" ? <SessionsSection /> : null}
            {section === "preferences" ? <PreferencesSection /> : null}
            {section === "lifecycle" ? <LifecycleSection /> : null}
            {feature ? (
              <div className="py-6">
                <EnterpriseUpsell feature={feature} heading={false} />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </ModulePage>
  );
}

function SettingsGroup({
  title,
  description,
  action,
  children,
  danger = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={[
        "grid gap-5 border-t py-8 first:border-t-0 first:pt-8 last:pb-8 2xl:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]",
        danger ? "border-destructive/30" : "border-border",
      ].join(" ")}
    >
      <div>
        <div className="flex items-center gap-2">
          <h3
            className={[
              "text-sm font-semibold",
              danger ? "text-destructive" : "text-foreground",
            ].join(" ")}
          >
            {title}
          </h3>
          {description ? <HelpTip label={description} /> : null}
        </div>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function HelpTip({ label }: { label: string }) {
  return (
    <Tooltip label={label}>
      <span
        tabIndex={0}
        aria-label="More information"
        className="inline-grid h-5 w-5 place-items-center rounded-full border border-border text-[11px] font-semibold text-muted-foreground outline-none transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        ?
      </span>
    </Tooltip>
  );
}

function ProfileSection() {
  const toast = useToast();
  const session = useSession();
  const profile = useProfile();

  const [fullName, setFullName] = useState(profile.fullName || session.data?.user?.name || "");
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile.fullName || session.data?.user?.name || "");
    setDisplayName(profile.displayName);
    setAvatar(profile.avatar);
  }, [profile, session.data?.user?.name]);

  async function save() {
    const name = fullName.trim() || "Owner";
    const handle = resolveDisplayName(fullName, displayName);
    setSaving(true);
    try {
      const result = await updateUser({ name, image: avatar || undefined });
      if (result?.error) throw new Error(result.error.message ?? "update_failed");
      setProfile({ ...getProfile(), fullName: name, displayName: handle, avatar });
      toast({ tone: "success", title: "Profile saved" });
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not save profile",
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SettingsGroup
        title="Profile image"
        description="Use a compact operator icon that appears in the dashboard navbar and profile menu."
      >
        <AvatarPicker value={avatar} fallbackName={displayName || fullName} onChange={setAvatar} />
      </SettingsGroup>

      <SettingsGroup
        title="Operator identity"
        description="The display name is the short name shown in Caracal chrome. The full name is stored on your authenticated user record."
        action={
          <Button onClick={save} loading={saving}>
            Save profile
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Full name"
            value={fullName}
            maxLength={NAME_MAX}
            onChange={(e) => setFullName(e.target.value.slice(0, NAME_MAX))}
          />
          <Field
            label="Display name"
            hint="Optional. Defaults to your first name. Shown in the profile menu."
            value={displayName}
            maxLength={HANDLE_MAX}
            onChange={(e) => setDisplayName(sanitizeHandle(e.target.value))}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup title="Account identifiers" description="Identifiers for this owner account.">
        <InfoGrid>
          <InfoItem label="Account ID" value={profile.accountId} mono />
          <InfoItem label="Email" value={session.data?.user?.email ?? "-"} mono />
          <InfoItem label="Role" value="Owner" />
        </InfoGrid>
      </SettingsGroup>
    </div>
  );
}

function AccessSection() {
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSession();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [changing, setChanging] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  async function submitPassword() {
    if (next.length < 8) {
      toast({
        tone: "error",
        title: "Password too short",
        description: "Use at least 8 characters.",
      });
      return;
    }
    setChanging(true);
    try {
      const result = await changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (result?.error) throw new Error(result.error.message ?? "change_failed");
      setCurrent("");
      setNext("");
      toast({
        tone: "success",
        title: "Password changed",
        description: "Other sessions were signed out.",
      });
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not change password",
        description:
          err instanceof Error ? err.message : "Check your current password and try again.",
      });
    } finally {
      setChanging(false);
    }
  }

  async function confirmSignOut() {
    await signOut();
    navigate({ to: "/sign-in" });
  }

  return (
    <div>
      <SettingsGroup
        title="Signed-in account"
        description="The authenticated owner for this web session."
      >
        <InfoGrid>
          <InfoItem label="Name" value={session.data?.user?.name ?? "-"} />
          <InfoItem label="Email" value={session.data?.user?.email ?? "-"} mono />
          <InfoItem label="Role" value="Owner" />
        </InfoGrid>
      </SettingsGroup>

      <SettingsGroup
        title="Password"
        description="Changing your password revokes every other active session immediately."
        action={
          <Button onClick={submitPassword} loading={changing} disabled={!current || !next}>
            Update password
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field
            label="Current password"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Field
            label="New password"
            type="password"
            hint="Minimum 8 characters."
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Sign out"
        description="End this browser session without changing account or control-plane data."
        action={
          <Button variant="secondary" onClick={() => setSignOutOpen(true)}>
            Sign out
          </Button>
        }
      >
        <InfoGrid>
          <InfoItem label="Effect" value="Current session only" />
          <InfoItem label="Data" value="Unchanged" />
        </InfoGrid>
      </SettingsGroup>

      <ConfirmModal
        open={signOutOpen}
        title="Sign out"
        description="Are you sure you want to sign out of Caracal? You will need to sign in again to continue."
        confirmLabel="Sign out"
        onClose={() => setSignOutOpen(false)}
        onConfirm={confirmSignOut}
      />
    </div>
  );
}

interface SessionRow {
  id: string;
  token?: string;
  createdAt?: string | Date;
  expiresAt?: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function SessionsSection() {
  const toast = useToast();
  const session = useSession();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentToken = (session.data?.session as { token?: string } | undefined)?.token;

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listSessions();
      if (result?.error) throw new Error(result.error.message ?? "list_failed");
      setRows((result?.data as SessionRow[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sessions.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revokeOthers() {
    setRevoking(true);
    try {
      const result = await revokeOtherSessions();
      if (result?.error) throw new Error(result.error.message ?? "revoke_failed");
      toast({ tone: "success", title: "Other sessions signed out" });
      await load();
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not revoke sessions",
        description: err instanceof Error ? err.message : "Unexpected error.",
      });
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div>
      <SettingsGroup
        title="Active sessions"
        description="Review authenticated devices and revoke every session except this browser."
        action={
          <Button
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            loading={revoking}
            disabled={!rows || rows.length <= 1}
          >
            Sign out other sessions
          </Button>
        }
      >
        <div className="min-h-[320px] border border-border bg-card">
          {rows === null ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : error ? (
            <p className="m-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No active sessions.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((row) => {
                const isCurrent = currentToken !== undefined && row.token === currentToken;
                return (
                  <li
                    key={row.id}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {describeAgent(row.userAgent)}
                        </span>
                        {isCurrent ? <Badge tone="success">This device</Badge> : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {row.ipAddress ? `${row.ipAddress} · ` : ""}
                        {row.createdAt ? `started ${new Date(row.createdAt).toLocaleString()}` : ""}
                      </div>
                    </div>
                    {row.expiresAt ? (
                      <span className="text-xs text-muted-foreground md:text-right">
                        expires {new Date(row.expiresAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SettingsGroup>

      <ConfirmModal
        open={confirmOpen}
        title="Sign out other sessions"
        description="This signs out every session except this one. Other devices will need to sign in again."
        confirmLabel="Sign out others"
        onClose={() => setConfirmOpen(false)}
        onConfirm={revokeOthers}
        danger
      />
    </div>
  );
}

function PreferencesSection() {
  const theme = useTheme();

  return (
    <div>
      <SettingsGroup
        title="Appearance"
        description="Theme applies immediately across the web console."
      >
        <div className="inline-flex border border-border bg-card p-1">
          {(["dark", "light"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
              className={[
                "h-8 px-3 text-xs font-medium capitalize transition-colors",
                theme === option
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
      </SettingsGroup>
    </div>
  );
}

function LifecycleSection() {
  const toast = useToast();
  const navigate = useNavigate();
  const session = useSession();
  const zones = useZones();
  const email = session.data?.user?.email ?? "";

  const [confirm, setConfirm] = useState("");
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const zoneCount = zones.data?.length ?? 0;
  const blocked = zones.isLoading;
  const confirmReady = confirm.trim() === email;

  async function confirmDelete() {
    setDeleting(true);
    try {
      // Profile deletion must be the guaranteed outcome: clean up owned zones on a
      // best-effort basis so a single zone failure (e.g. a 404 for an already
      // archived zone) can never leave the operator's profile behind.
      let zoneFailures = 0;
      try {
        const latest = await zones.refetch();
        for (const zone of latest.data ?? []) {
          try {
            await consoleApi.zones.delete(zone.id);
          } catch {
            zoneFailures += 1;
          }
        }
      } catch {
        zoneFailures += 1;
      }

      await deleteAccount(confirm);
      clearLocalIdentity();
      if (zoneFailures > 0) {
        toast({
          tone: "info",
          title: "Profile deleted",
          description: `${zoneFailures} zone${zoneFailures === 1 ? "" : "s"} could not be removed and may need manual cleanup.`,
        });
      }
      navigate({ to: "/sign-in" });
    } catch (err) {
      toast({
        tone: "error",
        title: "Could not delete profile",
        description:
          err instanceof AuthApiError
            ? err.code
            : err instanceof Error
              ? err.message
              : "Unexpected error.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <SettingsGroup
        title="Deletion scope"
        description="Profile deletion also removes owned zones."
      >
        <div className="grid gap-3 lg:grid-cols-3">
          <Metric
            label="Zones"
            value={zones.isLoading ? "..." : zones.isError ? "!" : String(zoneCount)}
          />
          <Metric label="Owner email" value={email || "-"} mono />
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="Delete profile"
        description="Permanently removes your profile, sessions, sign-in accounts, and zones."
        danger
      >
        <div className="border border-destructive/30 bg-destructive/5 p-4">
          {zones.isError ? (
            <p className="mt-3 text-sm text-destructive">Zone state unavailable.</p>
          ) : zoneCount > 0 ? (
            <p className="mt-3 text-sm text-destructive">
              Includes {zoneCount} zone{zoneCount === 1 ? "" : "s"}.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/app/zones"
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface"
            >
              Manage zones
            </Link>
            <Button variant="danger" disabled={blocked} onClick={() => setOpen(true)}>
              Delete profile
            </Button>
          </div>
        </div>

        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Delete profile"
          description="This deletes your profile, sessions, sign-in accounts, and all owned zones. This action cannot be undone."
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={confirmDelete}
                loading={deleting}
                disabled={!confirmReady}
              >
                Delete profile and zones
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Type <span className="font-mono text-foreground">{email}</span> to confirm.
            </p>
            <InfoGrid>
              <InfoItem label="Zones" value={String(zoneCount)} />
              <InfoItem label="Profile" value="Delete" />
            </InfoGrid>
            <Field
              label="Confirm email"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoFocus
            />
          </div>
        </Modal>
      </SettingsGroup>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  danger = false,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={confirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-3 border border-border bg-card p-4 md:grid-cols-3">{children}</dl>;
}

function InfoItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={["mt-1 truncate text-sm text-foreground", mono ? "font-mono text-xs" : ""].join(
          " ",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function Metric({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div
        className={[
          "mt-2 text-lg font-semibold text-foreground",
          mono ? "font-mono text-sm" : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function describeAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
      ? "macOS"
      : /Linux/.test(ua)
        ? "Linux"
        : /Android/.test(ua)
          ? "Android"
          : /iPhone|iPad/.test(ua)
            ? "iOS"
            : "";
  return os ? `${browser} on ${os}` : browser;
}
