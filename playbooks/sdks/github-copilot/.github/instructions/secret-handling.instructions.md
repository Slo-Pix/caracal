---
description: "Use when Caracal SDK setup involves secrets, tokens, API keys, client secrets, private keys, provider credentials, environment variables, or secret managers."
---
# Secret Handling

- Never ask users to paste secrets into chat.
- Mask any pasted or discovered secret before repeating it.
- Preserve only a short prefix and suffix when useful.
- Use environment variables or the user's existing secret manager.
- Do not hard-code tenant values, tokens, private keys, provider credentials, or client secrets.

Use placeholders such as `<CARACAL_API_URL>`, `<CARACAL_ZONE_ID>`, `<CARACAL_CLIENT_ID>`, and `<CARACAL_CLIENT_SECRET>`.
