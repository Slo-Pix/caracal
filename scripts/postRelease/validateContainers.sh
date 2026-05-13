#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Pulls each Caracal container image at its manifest-pinned tag and boots them via docker-compose.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/common.sh
source "$HERE/lib/common.sh"

readonly AREA="containers"
readonly REGISTRY="${CARACAL_REGISTRY:-ghcr.io/caracalai}"
readonly REPO_ROOT="$(cd "$HERE/../.." && pwd)"
readonly COMPOSE_SRC="$REPO_ROOT/infra/docker/docker-compose.yml"

validatePull() {
  local svc="$1" ver="$2"
  matchesOnly "$svc" || return 0
  local img="$REGISTRY/$svc:v$ver"
  if runOrEcho docker pull "$img" >/dev/null 2>&1; then
    logFinding "$AREA" "$img" "linux-x64" "ghcr" "docker" "$SEV_INFO" "$STATUS_PASS" "image pulled" "docker pull $img"
  else
    logFinding "$AREA" "$img" "linux-x64" "ghcr" "docker" "$SEV_BLOCKER" "$STATUS_FAIL" "docker pull failed" "docker pull $img"
  fi
}

validateStack() {
  matchesOnly "stack" || return 0
  if [[ ! -f "$COMPOSE_SRC" ]]; then
    logFinding "$AREA" "stack" "linux-x64" "compose" "docker" "$SEV_MAJOR" "$STATUS_WARN" "docker-compose.yml not found" "ls $COMPOSE_SRC"
    return 0
  fi
  local dir; dir="$(mktemp -d)"
  cp "$COMPOSE_SRC" "$dir/docker-compose.yml"
  local pinJson; pinJson="$(python3 -c '
import json, os
print(json.dumps({k: os.environ["V_"+k] for k in os.environ if k.startswith("V_")}))
' $(for k in "${!CONTAINER_VER[@]}"; do printf 'V_%s=%s ' "$k" "${CONTAINER_VER[$k]}"; done))"
  REG="$REGISTRY" PINS="$pinJson" python3 - "$dir/docker-compose.yml" <<'PY'
import json, os, sys
path = sys.argv[1]
reg = os.environ["REG"]
pins = json.loads(os.environ["PINS"])
lines = open(path).read().splitlines(keepends=True)

def indentOf(line):
    s = line.rstrip("\n")
    return len(s) - len(s.lstrip(" "))

svcIndent = None
for line in lines:
    if line.rstrip("\n").rstrip() == "services:" and indentOf(line) == 0:
        for follow in lines[lines.index(line) + 1:]:
            if follow.strip() == "":
                continue
            svcIndent = indentOf(follow)
            break
        break
if svcIndent is None:
    sys.exit("services: section not found")
childIndent = svcIndent + 2

for svc, ver in pins.items():
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if (
            indentOf(line) == svcIndent
            and line.strip() == f"{svc}:"
        ):
            out.append(line)
            i += 1
            body = []
            while i < len(lines):
                cur = lines[i]
                if cur.strip() == "":
                    body.append(cur); i += 1; continue
                if indentOf(cur) <= svcIndent:
                    break
                body.append(cur); i += 1
            j = 0
            cleaned = []
            while j < len(body):
                bl = body[j]
                if bl.strip() == "build:" and indentOf(bl) == childIndent:
                    j += 1
                    while j < len(body):
                        nxt = body[j]
                        if nxt.strip() == "" or indentOf(nxt) > childIndent:
                            j += 1
                        else:
                            break
                    continue
                cleaned.append(bl); j += 1
            replaced = False
            for k, bl in enumerate(cleaned):
                if bl.strip().startswith("image:") and indentOf(bl) == childIndent:
                    cleaned[k] = f"{' ' * childIndent}image: {reg}/{svc}:v{ver}\n"
                    replaced = True
                    break
            if not replaced:
                cleaned.insert(0, f"{' ' * childIndent}image: {reg}/{svc}:v{ver}\n")
            out.extend(cleaned)
        else:
            out.append(line); i += 1
    lines = out

open(path, "w").write("".join(lines))
PY
  if runOrEcho docker compose -f "$dir/docker-compose.yml" up -d >"$dir/up" 2>&1; then
    sleep 5
    logFinding "$AREA" "stack" "linux-x64" "compose" "docker" "$SEV_INFO" "$STATUS_PASS" "compose up succeeded" "docker compose up -d"
    runOrEcho docker compose -f "$dir/docker-compose.yml" down -v >/dev/null 2>&1 || true
  else
    logFinding "$AREA" "stack" "linux-x64" "compose" "docker" "$SEV_BLOCKER" "$STATUS_FAIL" "$(head -c 400 "$dir/up")" "docker compose up -d"
  fi
  rm -rf "$dir"
}

for s in "${!CONTAINER_VER[@]}"; do validatePull "$s" "${CONTAINER_VER[$s]}"; done
validateStack
