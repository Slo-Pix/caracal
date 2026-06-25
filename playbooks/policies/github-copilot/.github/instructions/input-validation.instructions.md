---
description: "Use when validating Caracal policy input fields, schemas, sample inputs, and assumptions before using them in a policy data document."
---
# Input Validation

- Check Caracal documentation and policy schemas for available fields.
- Compare the requirement with supplied sample input.
- Verify resource identifier, scopes, principal, application, context, session, grant, and delegation fields.
- Mark undocumented or missing fields as unknown.
- Ask for clarification instead of inventing fields.
- If the requirement depends on unsupported fields, say so plainly and recommend a workaround or issue report.

Only documented or supplied fields may appear in policy data.
