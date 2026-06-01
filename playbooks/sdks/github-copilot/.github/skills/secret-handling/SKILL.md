---
name: secret-handling
description: "Use when reviewing or implementing Caracal SDK setup that involves secrets, tokens, API keys, client secrets, private keys, provider credentials, or environment variables."
---
# Secret Handling

## Procedure

1. Never ask users to paste secrets into chat.
2. Mask any pasted or discovered secret before repeating it.
3. Preserve only a short prefix and suffix when useful.
4. Use environment variables or the user's existing secret manager.
5. Do not hard-code tenant values, tokens, private keys, provider credentials, or client secrets.

Continue guidance using placeholders such as `<CARACAL_API_URL>`, `<CARACAL_ZONE_ID>`, `<CARACAL_CLIENT_ID>`, and `<CARACAL_CLIENT_SECRET>`.
