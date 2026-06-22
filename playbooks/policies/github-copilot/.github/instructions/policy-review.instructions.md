---
description: "Use when reviewing Caracal policy data documents for data document shape, platform decision contract alignment, least privilege, deterministic data, and activation readiness."
---
# Policy Review

- Verify `package caracal.authz` and `import rego.v1`.
- Verify the platform decision contract denies by default and that data only grants or narrows.
- Verify the document defines only `app_ids`, `grants`, `confinement`, or `restrict` and never a `result` rule.
- Check resource and scope conditions for least privilege.
- Check actor, subject, session, grant, and delegation conditions.
- Identify undocumented input fields.
- Identify nondeterministic or side-effecting logic.
- Recommend validation, simulation, policy-set activation, and audit checks.

Only report issues that affect correctness, safety, maintainability, or production readiness.
