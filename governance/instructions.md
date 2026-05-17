# governance

## Scope
- Covers repository governance, incident response, and threat-model documents under `governance/`.

## Architecture Design
- Governance files are policy records, not implementation documentation.
- Security posture changes must remain traceable to the current OSS architecture and public process.

## Required
- Must keep governance language consistent with the root `SECURITY.md`, `CODE_OF_CONDUCT.md`, and current trust boundaries.
- Must update governance documents when service boundaries, disclosure process, or supported surfaces change.
- Must keep incident and threat-model guidance concrete enough for maintainers and agents to follow.

## Forbidden
- Must not include secrets, private contacts, embargoed vulnerabilities, or customer-specific data.
- Must not describe enterprise-only controls as open-source controls.
- Must not duplicate long-form setup or API documentation from `docs/`.

## Validation
- Review changed governance text against current service, package, and infrastructure boundaries.

