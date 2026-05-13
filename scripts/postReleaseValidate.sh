#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Orchestrates the post-release validation harness against the release manifest and renders the markdown findings report.

set -euo pipefail

RELEASE=""
CATEGORY="all"
REPORT_OUT=""
ONLY=""
DRY=0

usage() {
  cat <<EOF
Usage: $0 --release vYYYY.MM.DD [--category <list>] [--report-out <path>] [--only <list>] [--dry-run]

Categories: registryMetadata, pypiInstall, npmInstall, cliBinaries, tuiBinaries,
            installers, containers, provenance, examples, all
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release) RELEASE="$2"; shift 2 ;;
    --category) CATEGORY="$2"; shift 2 ;;
    --report-out) REPORT_OUT="$2"; shift 2 ;;
    --only) ONLY="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

[[ -z "$RELEASE" ]] && { usage; exit 2; }

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUB="$ROOT/scripts/postRelease"
MANIFEST="$ROOT/releases/$RELEASE/manifest.json"
FINDINGS_DIR="${FINDINGS_DIR:-$(mktemp -d)}"
REPORT_OUT="${REPORT_OUT:-$ROOT/releases/$RELEASE/validation.md}"

if [[ ! -f "$MANIFEST" ]]; then
  echo "orchestrator: manifest not found: $MANIFEST" >&2
  exit 2
fi

export CARACAL_RELEASE="$RELEASE"
export FINDINGS_DIR
export ONLY
export DRY_RUN="$DRY"
export MANIFEST

declare -a CATS
if [[ "$CATEGORY" == "all" ]]; then
  CATS=(registryMetadata pypiInstall npmInstall cliBinaries tuiBinaries installers containers provenance examples)
else
  IFS=',' read -r -a CATS <<< "$CATEGORY"
fi

for c in "${CATS[@]}"; do
  script="$SUB/validate$(tr '[:lower:]' '[:upper:]' <<< "${c:0:1}")${c:1}.sh"
  if [[ ! -x "$script" ]]; then
    echo "missing or non-executable: $script" >&2
    exit 2
  fi
  echo "==> $c"
  "$script" || echo "  ($c reported failures; continuing)"
done

REPORT_OUT="$REPORT_OUT" FINDINGS_DIR="$FINDINGS_DIR" CARACAL_RELEASE="$RELEASE" MANIFEST="$MANIFEST" \
  bun "$SUB/aggregateReport.ts"
