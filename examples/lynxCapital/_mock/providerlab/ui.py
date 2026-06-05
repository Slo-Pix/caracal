"""
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Server-rendered control panel for each lab provider with credentials, clients, and API client pages.
"""
from __future__ import annotations

import html

from _mock.providerlab import catalog, credentials

_CATEGORY_LABEL = {
    "api_key": "API key",
    "bearer_token": "Bearer token",
    "oauth2_client_credentials": "OAuth 2.0 client credentials",
    "oauth2_authorization_code": "OAuth 2.0 authorization code",
    "caracal_mandate": "Caracal mandate (partnership)",
    "none": "Internal (no upstream credential)",
    "mcp": "MCP server",
    "sdk": "Provider SDK",
}


def _esc(value) -> str:
    return html.escape(str(value))


def layout(provider: catalog.Provider, active: str, body: str) -> str:
    nav = []
    for key, label in (("home", "Dashboard"), ("resources", "Resources"),
                       ("credentials", "Credentials"), ("clients", "Clients"),
                       ("api-clients", "API clients")):
        href = "/" if key == "home" else f"/__lab/{key}"
        cls = "active" if active == key else ""
        nav.append(f'<a class="{cls}" href="{href}">{label}</a>')
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><title>{_esc(provider.brand)} · provider lab</title>
<style>
  body {{ font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; background: #0f1320; color: #e7ecf5; }}
  header {{ padding: 18px 28px; border-bottom: 1px solid #232a3d; background: #141a2b; }}
  header h1 {{ font-size: 17px; margin: 0; }}
  header .tag {{ color: #8b97b4; font-size: 12px; margin-top: 3px; }}
  .badge {{ display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #243049; color: #9fc0ff; margin-left: 8px; }}
  nav {{ display: flex; gap: 4px; padding: 0 22px; background: #141a2b; border-bottom: 1px solid #232a3d; }}
  nav a {{ padding: 10px 14px; color: #9aa6c2; text-decoration: none; font-size: 13px; border-bottom: 2px solid transparent; }}
  nav a.active {{ color: #fff; border-bottom-color: #5d8bff; }}
  main {{ padding: 24px 28px; max-width: 920px; }}
  h2 {{ font-size: 14px; margin: 22px 0 10px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 14px; }}
  th, td {{ text-align: left; padding: 7px 9px; border-bottom: 1px solid #232a3d; }}
  th {{ color: #8b97b4; font-weight: 600; }}
  code {{ font-family: ui-monospace, monospace; font-size: 11px; background: #1b2236; padding: 1px 5px; border-radius: 3px; color: #cdd7ee; word-break: break-all; }}
  form.inline {{ display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0 18px; }}
  input, select {{ background: #1b2236; border: 1px solid #2c364f; color: #e7ecf5; padding: 6px 8px; border-radius: 4px; font-size: 12px; }}
  button {{ background: #2f56b5; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; }}
  button.danger {{ background: #7a2b39; }}
  .muted {{ color: #8b97b4; font-size: 12px; }}
  .panel {{ background: #141a2b; border: 1px solid #232a3d; border-radius: 6px; padding: 16px; margin-bottom: 16px; }}
  .pill {{ font-size: 11px; padding: 1px 7px; border-radius: 9px; }}
  .ok {{ background: #1d3b2a; color: #7fe0a6; }}
  .gone {{ background: #3b1d22; color: #e08a98; }}
</style></head>
<body>
<header>
  <h1>{_esc(provider.brand)} <span class="badge">{_esc(_CATEGORY_LABEL[provider.category])}</span></h1>
  <div class="tag">{_esc(provider.tagline)} · localhost:{provider.port}</div>
</header>
<nav>{''.join(nav)}</nav>
<main>{body}</main>
</body></html>"""


def overview(provider: catalog.Provider) -> str:
    store = credentials.load(provider.id)
    seed = store.data["seed"]
    rows = "".join(
        f"<tr><td>{_esc(k)}</td><td><code>{_esc(v)}</code></td></tr>"
        for k, v in seed.items() if not isinstance(v, (list, dict))
    )
    ops = "".join(f"<li><code>{_esc(o)}</code></li>" for o in provider.operations)
    auth_summary = _auth_summary(provider)
    body = f"""
<div class="panel">
  <h2>How callers authenticate</h2>
  <p class="muted">{auth_summary}</p>
</div>
<div class="panel">
  <h2>Seed credential (for verification flows)</h2>
  <table><tr><th>field</th><th>value</th></tr>{rows}</table>
  <p class="muted">Seed material is persisted under <code>_store/{_esc(provider.id)}.json</code> and indexed in <code>_store/_seed_index.json</code>.</p>
</div>
<div class="panel">
  <h2>Operations</h2>
  <ul>{ops}</ul>
  <p class="muted">Domain calls are served under <code>/api/&lt;operation&gt;</code>.</p>
</div>"""
    return layout(provider, "home", body)


def _auth_summary(provider: catalog.Provider) -> str:
    c = provider.category
    if c in ("api_key", "sdk"):
        loc = "query parameter" if provider.apikey_location == "query" else "header"
        return f"Send the API key in the <code>{_esc(provider.apikey_field)}</code> {loc}."
    if c == "bearer_token":
        return f"Send the static token as <code>{_esc(provider.auth_header)}: {_esc(provider.auth_scheme)} &lt;token&gt;</code>."
    if c == "oauth2_client_credentials":
        return (f"Exchange client credentials at <code>POST /oauth/token</code> "
                f"(grant_type=client_credentials, {_esc(provider.client_auth_method)}), then call with the access token.")
    if c == "oauth2_authorization_code":
        extra = "PKCE required. " if provider.use_pkce else ""
        extra += "Issues refresh tokens (offline access). " if provider.offline_access else ""
        return (f"{extra}Authorize at <code>GET /oauth/authorize</code>, exchange the code at "
                f"<code>POST /oauth/token</code>, then call with the access token.")
    if c == "caracal_mandate":
        d = " A delegated mandate is required." if provider.require_delegation else ""
        return (f"Present a Caracal mandate as <code>Authorization: Bearer &lt;mandate&gt;</code>. "
                f"The provider verifies it like a Caracal verifier SDK at its boundary.{d}")
    if c == "none":
        return "Internal provider. No upstream credential; access is trusted at the network boundary."
    if c == "mcp" and provider.mcp_auth == "mandate":
        return "MCP JSON-RPC at <code>POST /mcp</code>, guarded by a Caracal mandate."
    if c == "mcp":
        return "MCP JSON-RPC at <code>POST /mcp</code>, guarded by a bearer token."
    return ""


def _cred_table(title: str, headers: list[str], rows: list[str]) -> str:
    head = "".join(f"<th>{_esc(h)}</th>" for h in headers)
    body = "".join(rows) or f'<tr><td colspan="{len(headers)}" class="muted">none</td></tr>'
    return f"<h2>{_esc(title)}</h2><table><tr>{head}</tr>{body}</table>"


def _status_pill(revoked: bool) -> str:
    return '<span class="pill gone">revoked</span>' if revoked else '<span class="pill ok">active</span>'


def credentials_page(provider: catalog.Provider) -> str:
    store = credentials.load(provider.id)
    cat = provider.category
    sections: list[str] = []

    if cat in ("api_key", "sdk"):
        rows = [
            f"<tr><td><code>{_esc(r['keyId'])}</code></td><td><code>{_esc(r['apiKey'])}</code></td>"
            f"<td>{_esc(r['label'])}</td><td>{_status_pill(r['revoked'])}</td>"
            f"<td>{_revoke_btn('apiKey', r['keyId'], r['revoked'])}</td></tr>"
            for r in store.data["apiKeys"]
        ]
        sections.append(_cred_table("API keys", ["keyId", "apiKey", "label", "status", ""], rows))
        sections.append(_create_form("apiKey", "Create API key"))

    if cat == "bearer_token" or (cat == "mcp" and provider.mcp_auth == "bearer"):
        rows = [
            f"<tr><td><code>{_esc(r['tokenId'])}</code></td><td><code>{_esc(r['accessToken'])}</code></td>"
            f"<td>{_esc(r['label'])}</td><td>{_status_pill(r['revoked'])}</td>"
            f"<td>{_revoke_btn('bearer', r['tokenId'], r['revoked'])}</td></tr>"
            for r in store.data["bearerTokens"]
        ]
        sections.append(_cred_table("Bearer tokens", ["tokenId", "accessToken", "label", "status", ""], rows))
        sections.append(_create_form("bearer", "Issue bearer token"))

    if cat in ("oauth2_client_credentials", "oauth2_authorization_code"):
        rows = [
            f"<tr><td><code>{_esc(r['clientId'])}</code></td><td><code>{_esc(r['clientSecret'])}</code></td>"
            f"<td>{_esc(', '.join(r['scopes']))}</td><td>{_status_pill(r['revoked'])}</td></tr>"
            for r in store.data["clients"]
        ]
        sections.append(_cred_table("OAuth client secrets", ["clientId", "clientSecret", "scopes", "status"], rows))
        sections.append('<p class="muted">Register and manage clients on the <a href="/__lab/clients">Clients</a> page.</p>')

    if cat == "caracal_mandate" or (cat == "mcp" and provider.mcp_auth == "mandate"):
        seed = store.data["seed"].get("mandate", "")
        revoked = "".join(f"<tr><td><code>{_esc(a)}</code></td></tr>" for a in store.data["revoked"]) \
            or '<tr><td class="muted">none</td></tr>'
        sections.append(f"""
<h2>Zone signing key</h2>
<table><tr><th>zone</th><th>signing key (HS256)</th></tr>
<tr><td><code>{_esc(store.data['zone'])}</code></td><td><code>{_esc(store.data['signing_key'])}</code></td></tr></table>
<h2>Seed mandate</h2>
<p><code>{_esc(seed)}</code></p>
<h2>Revoked anchors</h2>
<table><tr><th>anchor</th></tr>{revoked}</table>
<form class="inline" method="post" action="/__lab/api/revoke-anchor">
  <input name="anchor" placeholder="sid_/agent_/edge_ anchor to revoke" size="32" required>
  <button class="danger" type="submit">Revoke anchor</button>
</form>""")

    if cat == "none":
        sections.append('<div class="panel"><p class="muted">This internal provider holds no credentials. '
                        'Access is enforced at the network boundary only.</p></div>')

    return layout(provider, "credentials", "".join(sections))


def resource_explorer_page(provider: catalog.Provider, state) -> str:
    """Render the provider's live domain data model: each resource table with a count and sample row."""
    from _mock.providerlab.providers import base

    with state.lock:
        if not state.seeded:
            seed = base.SEEDERS.get(provider.id)
            if seed is not None:
                seed(state)
            state.seeded = True
        tables = {name: dict(rows) for name, rows in state.tables.items()}

    panels = []
    for resource in provider.resources:
        rows = tables.get(resource, {})
        sample = next(iter(rows.values()), None)
        fields = ", ".join(f"<code>{_esc(k)}</code>" for k in sample.keys()) if isinstance(sample, dict) else "—"
        sample_json = _esc(sample) if sample is not None else "no rows yet"
        panels.append(f"""
<div class="panel">
  <h2>{_esc(resource)} <span class="badge">{len(rows)} record(s)</span></h2>
  <p class="muted">fields: {fields}</p>
  <code>{sample_json}</code>
</div>""")
    if not panels:
        panels.append('<div class="panel"><p class="muted">This provider exposes no stored resources.</p></div>')
    intro = (f'<div class="panel"><p class="muted">Live data served by {_esc(provider.brand)} on this port. '
             f'Records evolve as operations run against <code>/api/&lt;operation&gt;</code>.</p></div>')
    return layout(provider, "resources", intro + "".join(panels))


def clients_page(provider: catalog.Provider) -> str:
    store = credentials.load(provider.id)
    cat = provider.category
    if cat in ("oauth2_client_credentials", "oauth2_authorization_code"):
        rows = [
            f"<tr><td><code>{_esc(r['clientId'])}</code></td><td>{_esc(r['name'])}</td>"
            f"<td>{_esc(', '.join(r['redirectUris']))}</td><td>{_esc(', '.join(r['scopes']))}</td>"
            f"<td>{_status_pill(r['revoked'])}</td>"
            f"<td>{_revoke_btn('client', r['clientId'], r['revoked'])}</td></tr>"
            for r in store.data["clients"]
        ]
        table = _cred_table("Registered OAuth clients", ["clientId", "name", "redirectUris", "scopes", "status", ""], rows)
        form = f"""
<h2>Register client</h2>
<form class="inline" method="post" action="/__lab/api/register-client">
  <input name="name" placeholder="application name" required>
  <input name="redirect_uris" placeholder="redirect URI" size="34" value="http://127.0.0.1:8000/callback">
  <input name="scopes" placeholder="scopes" value="{_esc(' '.join(provider.scopes))}" size="22">
  <button type="submit">Register</button>
</form>"""
        return layout(provider, "clients", table + form)

    body = ('<div class="panel"><p class="muted">This provider does not use OAuth application clients. '
            'Machine consumers are managed as credentials and shown on the '
            '<a href="/__lab/api-clients">API clients</a> page.</p></div>')
    return layout(provider, "clients", body)


def api_clients_page(provider: catalog.Provider, activity: list[dict]) -> str:
    rows = [
        f"<tr><td>{_esc(a['principal'])}</td><td>{_esc(a['auth'])}</td><td>{a['calls']}</td>"
        f"<td><code>{_esc(a['last_op'])}</code></td><td>{a['last_status']}</td></tr>"
        for a in activity
    ]
    table = _cred_table("Live API clients", ["principal", "auth", "calls", "last operation", "last status"], rows)
    note = ('<p class="muted">API clients are derived from authenticated calls observed on this provider port. '
            'Issue credentials on the <a href="/__lab/credentials">Credentials</a> page, then call '
            f'<code>/api/&lt;operation&gt;</code>.</p>')
    return layout(provider, "api-clients", table + note)


def _create_form(kind: str, label: str) -> str:
    return f"""
<form class="inline" method="post" action="/__lab/api/create-credential">
  <input type="hidden" name="kind" value="{_esc(kind)}">
  <input name="label" placeholder="label" required>
  <button type="submit">{_esc(label)}</button>
</form>"""


def _revoke_btn(kind: str, identifier: str, revoked: bool) -> str:
    if revoked:
        return ""
    return f"""<form method="post" action="/__lab/api/revoke" style="margin:0">
  <input type="hidden" name="kind" value="{_esc(kind)}">
  <input type="hidden" name="id" value="{_esc(identifier)}">
  <button class="danger" type="submit">Revoke</button></form>"""
