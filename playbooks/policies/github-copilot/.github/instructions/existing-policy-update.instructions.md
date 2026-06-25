---
description: "Use when updating an existing Caracal policy data document while preserving current behavior and making the smallest safe change."
---
# Existing Policy Update

- Read the current policy and identify current allow and deny behavior.
- Identify the intended behavior change.
- Identify behavior that must not regress.
- Verify all input fields against documentation, schemas, sample input, or existing tests.
- Consider whether a smaller or safer data-only change can achieve the same result.
- Make the smallest focused change.
- Provide simulation cases for unchanged behavior, newly allowed behavior, and newly denied behavior.

Preserve the data document shape; the platform decision contract denies by default.
