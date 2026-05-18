#!/usr/bin/env bash
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Entry point for rc versioning and manifests.

set -euo pipefail

cd "$(dirname "$0")/.."
exec node scripts/rc.mjs "$@"
