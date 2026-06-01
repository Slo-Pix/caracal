---
name: safe-implementation
description: "Use after user confirmation to integrate Caracal SDK with minimal changes, existing patterns, official APIs, and real SDK behavior."
---
# Safe Implementation

## Procedure

1. Confirm the user approved the integration approach.
2. Verify SDK docs and version compatibility.
3. Reuse existing files, modules, services, configuration, and dependency patterns.
4. Keep changes small and focused.
5. Use real SDK components and official APIs.
6. Store secrets in environment variables or the user's existing secret manager.
7. Run existing validation commands.

Do not mock Caracal, create placeholder integrations, or restructure the repository.
