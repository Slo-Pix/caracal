/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

This file provides the reusable list-and-detail workspace used by Console object pages.
*/
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { ModulePage } from "@/components/console/ModulePage";
import {
  Button,
  DataTable,
  Drawer,
  EmptyState,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  type Column,
  type Crumb,
  type SortState,
} from "@/components/ui";

export interface SortOption {
  id: string;
  label: string;
}

export interface WorkspaceEmpty {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ResourceWorkspace<T>({
  title,
  description,
  breadcrumbs,
  primaryAction,
  rows,
  loading,
  columns,
  rowKey,
  search,
  sortOptions,
  sortComparators,
  initialSort,
  pageSize = 8,
  empty,
  detail,
  headerExtra,
}: {
  title: string;
  description: string;
  breadcrumbs: Crumb[];
  primaryAction?: { label: string; onClick: () => void };
  rows: T[];
  loading: boolean;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  search: { placeholder: string; match: (row: T, query: string) => boolean };
  sortOptions?: SortOption[];
  // Comparator per sort option id. When provided, the selected option actually orders the
  // rows; without it the sort dropdown is inert (legacy behavior preserved for callers that
  // do not pass comparators).
  sortComparators?: Record<string, (a: T, b: T) => number>;
  initialSort?: SortState;
  pageSize?: number;
  empty: WorkspaceEmpty;
  detail?: {
    title: (row: T) => string;
    description?: (row: T) => string;
    render: (row: T) => ReactNode;
    width?: string;
  };
  headerExtra?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [sortChoice, setSortChoice] = useState(sortOptions?.[0]?.id ?? "");
  const [sort, setSort] = useState<SortState | undefined>(initialSort);
  const [page, setPage] = useState(1);
  const [pageSizeValue, setPageSizeValue] = useState(pageSize);
  const [selected, setSelected] = useState<T | null>(null);

  useEffect(() => {
    setPage(1);
  }, [query, sortChoice, sort, pageSizeValue]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    return rows.filter((row) => search.match(row, query.toLowerCase()));
  }, [rows, query, search]);

  const sorted = useMemo(() => {
    const comparator = sortComparators?.[sortChoice];
    if (!comparator) return filtered;
    return [...filtered].sort(comparator);
  }, [filtered, sortComparators, sortChoice]);

  const paged = useMemo(
    () => sorted.slice((page - 1) * pageSizeValue, page * pageSizeValue),
    [sorted, page, pageSizeValue],
  );

  function toggleSort(column: string) {
    setSort((prev) =>
      prev?.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  // The toolbar is always present so the page frame never reflows between empty, loading,
  // and populated states. Its controls lock when there is nothing to act on (loading, or no
  // data at all) and unlock as soon as real rows arrive. A zero-result search still keeps
  // them enabled so the operator can edit or clear the query.
  const controlsLocked = loading || rows.length === 0;

  return (
    <ModulePage title={title} description={description} breadcrumbs={breadcrumbs}>
      {headerExtra ? <div className="mb-4">{headerExtra}</div> : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          placeholder={search.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={controlsLocked}
          aria-label={search.placeholder}
          className="w-full sm:w-72"
        />
        {sortOptions && sortOptions.length > 0 ? (
          <div className="w-44">
            <Select
              value={sortChoice}
              onChange={(e) => setSortChoice(e.target.value)}
              disabled={controlsLocked}
              aria-label="Sort by"
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        {primaryAction ? (
          <div className="ml-auto">
            <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
          </div>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        rows={paged}
        rowKey={rowKey}
        loading={loading}
        skeletonRows={pageSizeValue}
        sort={sort}
        onSortChange={toggleSort}
        onRowClick={detail ? (row) => setSelected(row) : undefined}
        empty={
          <EmptyState
            title={query ? "No matches" : empty.title}
            description={query ? "Try a different search term." : empty.description}
            action={
              !query && empty.actionLabel && empty.onAction ? (
                <Button onClick={empty.onAction}>{empty.actionLabel}</Button>
              ) : undefined
            }
          />
        }
      />

      {loading ? (
        <div className="flex h-[49px] items-center justify-end gap-2 border-x border-b border-border bg-card px-4">
          <Skeleton className="h-4 w-40" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="border-x border-b border-border bg-card">
          <Pagination
            page={page}
            pageSize={pageSizeValue}
            total={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSizeValue}
          />
        </div>
      ) : null}

      {detail ? (
        <Drawer
          open={selected !== null}
          onClose={() => setSelected(null)}
          title={selected ? detail.title(selected) : ""}
          description={selected && detail.description ? detail.description(selected) : undefined}
          icon={selected ? <Monogram label={detail.title(selected)} /> : undefined}
          width={detail.width}
        >
          {selected ? detail.render(selected) : null}
        </Drawer>
      ) : null}
    </ModulePage>
  );
}

/* ---- shared detail-panel building blocks for a consistent drawer layout ---- */

// A square monogram derived from an object's name, used as the leading icon in detail
// drawers so every panel opens with a consistent visual anchor.
export function Monogram({ label }: { label: string }) {
  const initials =
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("") || "•";
  return (
    <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-muted text-xs font-semibold text-muted-foreground">
      {initials}
    </span>
  );
}

// A hero row pinned to the top of a detail panel: status badges on the left, primary
// actions (e.g. Edit) pushed to the right, with a hairline separating it from the body.
export function DetailHeader({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
      {children}
      {action ? <div className="ml-auto flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

// A titled section with an optional trailing action, so every panel groups content the same
// way. Sections are separated by the panel's container gap, not ad-hoc top borders.
export function DetailSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </h3>
        {action ?? null}
      </div>
      {children}
    </section>
  );
}

// A bordered key/value card. Each DetailField is a responsive two-column row so labels and
// values align cleanly and use the full panel width.
export function DetailGroup({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DetailSection title={title} action={action}>
      <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {children}
      </dl>
    </DetailSection>
  );
}

export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 px-3 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground sm:pt-px">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

// A consistent destructive footer block for irreversible actions across every detail panel.
export function DangerZone({
  description,
  actionLabel,
  onAction,
}: {
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <DetailSection title="Danger zone">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3">
        <p className="min-w-0 text-xs text-muted-foreground">{description}</p>
        <Button variant="danger" size="sm" onClick={onAction} className="flex-shrink-0">
          {actionLabel}
        </Button>
      </div>
    </DetailSection>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <span className="break-all font-mono text-xs text-foreground">{children}</span>;
}

// An inline value with a copy affordance, for identifiers and other reference strings that
// operators routinely copy out of a detail panel.
export function CopyValue({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <span
        className={
          mono
            ? "min-w-0 break-all font-mono text-xs text-foreground"
            : "min-w-0 break-words text-sm text-foreground"
        }
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy"}
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }}
        className="grid h-5 w-5 flex-shrink-0 place-items-center rounded text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {copied ? (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      </button>
    </span>
  );
}
