---
description: "Review a Caracal policy data document for correctness, least privilege, deterministic data, and activation readiness."
argument-hint: "Policy source, expected behavior, and sample inputs"
tools: [read, search, web]
---
# Review Caracal Policy

Review the policy for:

- data document shape (`app_ids`, `grants`, `confinement`, or `restrict`, never a `result` rule)
- the platform decision contract that denies by default
- resource and scope precision
- verified input fields
- deterministic and side-effect-free data
- confinement and restriction overlays that only narrow authority
- a simpler grant, confinement, or restriction shape when one would be safer
- simulation and activation readiness

Explain the policy's effect in plain language alongside the review.

Return only issues that affect correctness, safety, maintainability, or production readiness.
