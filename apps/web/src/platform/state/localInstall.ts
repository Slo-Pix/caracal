/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file holds browser-local Community Edition identity: the operator profile, onboarding state, and active-zone selection.
*/
export interface InstallationRecord {
  name: string;
  onboarded: boolean;
}

export interface ProfileRecord {
  accountId: string;
  fullName: string;
  displayName: string;
  avatar: string;
}

const INSTALL_KEY = "caracal.install";
const ACTIVE_ZONE_KEY = "caracal.activeZone";
const PROFILE_KEY = "caracal.profile";

function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getInstallation(): InstallationRecord {
  return read<InstallationRecord>(INSTALL_KEY, { name: "", onboarded: false });
}

export function setInstallation(record: InstallationRecord): void {
  write(INSTALL_KEY, record);
}

export function isOnboarded(): boolean {
  return getInstallation().onboarded;
}

export function getActiveZoneId(): string | null {
  return read<string | null>(ACTIVE_ZONE_KEY, null);
}

export function setActiveZoneId(id: string): void {
  write(ACTIVE_ZONE_KEY, id);
}

/** Generate a stable, unique internal account identifier, formatted CRC-XXXX-XXXX-XXXX. */
function generateAccountId(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const pick = () =>
    Array.from(
      typeof crypto !== "undefined" && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint8Array(4))
        : [0, 0, 0, 0].map(() => Math.floor(Math.random() * 256)),
      (byte) => alphabet[byte % alphabet.length],
    ).join("");
  return `CRC-${pick()}-${pick()}-${pick()}`;
}

export function getProfile(): ProfileRecord {
  const stored = read<Partial<ProfileRecord>>(PROFILE_KEY, {});
  const accountId =
    stored.accountId && stored.accountId.startsWith("CRC-")
      ? stored.accountId
      : generateAccountId();
  const profile: ProfileRecord = {
    accountId,
    fullName: stored.fullName ?? "",
    displayName: stored.displayName ?? "",
    avatar: stored.avatar ?? "",
  };
  if (stored.accountId !== accountId) write(PROFILE_KEY, profile);
  return profile;
}

export function setProfile(record: ProfileRecord): void {
  write(PROFILE_KEY, record);
}

/** Human label for the active workspace shown in the Console chrome. */
export function workspaceLabel(): string {
  const profile = getProfile();
  return profile.displayName.trim() || profile.fullName.trim() || "Caracal";
}

export function completeOnboarding(profile: ProfileRecord): void {
  setProfile(profile);
  setInstallation({ name: workspaceLabel(), onboarded: true });
}

export function resetInstallation(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(INSTALL_KEY);
  localStorage.removeItem(ACTIVE_ZONE_KEY);
  localStorage.removeItem(PROFILE_KEY);
}
