# Caracal SDK Integration Instructions

Follow `AGENTS.md` first. This workspace helps integrate Caracal SDKs into existing products after discovery and user confirmation.

- Understand the product, architecture, auth model, credential handling, provider management, and resource access before proposing integration.
- Confirm understanding with the user before planning implementation.
- Confirm the proposed integration approach before editing code.
- Verify Caracal SDK version, framework version, runtime version, package manager, and deployment environment.
- Use Caracal and SDK documentation, plus documentation MCPs such as Context7 when available.
- Reuse existing files, modules, services, configuration, dependency injection, middleware, and framework conventions.
- Keep integrations thin and official-SDK recognizable.
- Do not invent SDK APIs, create placeholders, mock Caracal behavior, or hard-code secrets.
