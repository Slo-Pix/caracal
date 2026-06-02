#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Stages centralized Go source-package tests for a single command.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="$root/tests/source/go"
manifest="$(mktemp)"

cleanup() {
  if [[ -s "$manifest" ]]; then
    while IFS= read -r target; do
      rm -f "$target"
    done < "$manifest"
  fi
  rm -f "$manifest"
}

trap cleanup EXIT

if [[ ! -d "$source_dir" ]]; then
  echo "missing Go source test directory: $source_dir" >&2
  exit 1
fi

while IFS= read -r source_file; do
  rel="${source_file#"$source_dir"/}"
  target="$root/$rel"
  if [[ -e "$target" ]]; then
    echo "refusing to overwrite existing test file: ${target#"$root"/}" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$target")"
  cp "$source_file" "$target"
  printf '%s\n' "$target" >> "$manifest"
done < <(find "$source_dir" -type f -name '*_test.go' | sort)

"$@"
