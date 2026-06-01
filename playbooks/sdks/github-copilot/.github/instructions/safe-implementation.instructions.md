---
description: "Use after user confirmation to implement Caracal SDK integration with minimal changes, existing patterns, official APIs, and real SDK behavior."
---
# Safe Implementation

- Confirm the user approved the integration approach.
- Verify SDK docs and version compatibility.
- Reuse existing files, modules, services, configuration, dependency injection, middleware, and framework conventions.
- Keep changes small and focused.
- Use real SDK components and official APIs.
- Store secrets in environment variables or the user's existing secret manager.
- Run existing validation commands.

Do not mock Caracal, create placeholder integrations, invent APIs, or restructure the repository.
