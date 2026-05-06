<div align="center">
<picture>
<source media="(prefers-color-scheme: dark)" srcset="public/caracal_nobg_dark_mode.png">
<source media="(prefers-color-scheme: light)" srcset="public/caracal_nobg.png">
<img alt="Caracal Logo" src="public/caracal_nobg.png" width="300">
</picture>
</div>

<div align="center">

**Pre-execution authority enforcement for AI agents**
</div>

<div align="center">

[![License](https://img.shields.io/badge/License-Apache--2.0-blue?style=for-the-badge&logo=gnubash&logoColor=white)](LICENSE)
[![Version](https://img.shields.io/github/v/release/Garudex-Labs/caracal?style=for-the-badge&label=Release&color=orange)](https://github.com/Garudex-Labs/caracal/releases)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue?style=for-the-badge&logo=python&logoColor=white)](pyproject.toml)
[![Repo Size](https://img.shields.io/github/repo-size/Garudex-Labs/caracal?style=for-the-badge&color=green)](https://github.com/Garudex-Labs/caracal)
[![Website](https://img.shields.io/badge/Website-garudexlabs.com-333333?style=for-the-badge&logo=google-chrome&logoColor=white)](https://garudexlabs.com)

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12350/badge)](https://www.bestpractices.dev/projects/12350) 
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Garudex-Labs/caracal/badge)](https://scorecard.dev/viewer/?uri=github.com/Garudex-Labs/caracal) 
[![codecov](https://codecov.io/github/garudex-labs/caracal/graph/badge.svg?token=2Z0FY88RF5)](https://codecov.io/github/garudex-labs/caracal)
</div>

-----

# Overview

**Caracal** is a pre-execution authority enforcement system for AI agents and automated software operating in production environments. It exists at the boundary where autonomous decisions turn into irreversible actions such as API calls, database writes, or system triggers.

By enforcing the **principle of explicit authority**, Caracal ensures no action executes without a cryptographically verified, time-bound mandate issued under a governing policy.

-----

## Community

<div align="center">
<table>
<tr>
<td align="center">
<a href="https://www.youtube.com/live/tZ4FdO-zjeE" target="_blank" rel="noopener">
<img src="https://img.youtube.com/vi/tZ4FdO-zjeE/hqdefault.jpg" alt="Open Source Friday — Preview" height="180"><br>
<strong>GitHub's Open Source Friday</strong>
</a>
</td>
<td align="center">
<div style="width:320px;height:180px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px solid #ddd;background:#f8f8f8;font-weight:600">
More coming soon
</div>
</td>
</tr>
</table>
</div>

</div>

<div align="center">
</div>

-----

## Installation & Setup

### Quickstart

> Only Docker is required. The CLI is a single self-contained binary. Pin a version with `CARACAL_VERSION=vX.Y.Z` before the install command.

<details open>
<summary><strong>Linux</strong> (x64 / arm64) curl or wget</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/Garudex-Labs/caracal/main/install.sh | sh
# or, without curl:
wget -qO- https://raw.githubusercontent.com/Garudex-Labs/caracal/main/install.sh | sh
```

Installs to `~/.local/bin/caracal`. Override with `CARACAL_INSTALL_DIR=/usr/local/bin` (may need `sudo`).

</details>

<details>
<summary><strong>macOS</strong> (Intel / Apple Silicon)</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/Garudex-Labs/caracal/main/install.sh | sh
```

If Gatekeeper blocks the binary on first run: `xattr -d com.apple.quarantine ~/.local/bin/caracal`.

</details>

<details>
<summary><strong>Windows</strong> (x64) PowerShell</summary>

```powershell
iwr -useb https://raw.githubusercontent.com/Garudex-Labs/caracal/main/install.ps1 | iex
```

Installs to `%LOCALAPPDATA%\Programs\caracal\caracal.exe` and adds it to the user `PATH`. Requires Docker Desktop with WSL2.

</details>

<details>
<summary><strong>Manual</strong> direct download</summary>

Grab the matching asset from the [latest release](https://github.com/Garudex-Labs/caracal/releases/latest) (`caracal-linux-x64`, `caracal-linux-arm64`, `caracal-darwin-x64`, `caracal-darwin-arm64`, or `caracal-windows-x64.exe`), verify against `SHA256SUMS`, then place it on your `PATH` and `chmod +x` (Unix).

</details>

<p></p>

Then, on any platform:

```bash
caracal up
caracal init
caracal run -- printenv RESOURCE_TOKEN
```

### Basic commands

```bash
caracal up
caracal status
caracal down
caracal init
caracal run -- <cmd...>
caracal credential read <resource>
```

### Inspect with the Terminal UI

A read-only TUI ships next to `caracal` for interactively browsing zones, applications, resources, providers, policies, policy-sets, grants, sessions, agents, and a live audit tail.

```bash
export CARACAL_ADMIN_TOKEN=<your admin token>   # the installer prints this; or read it from infra/docker/.env
caracal-tui
```

Useful environment variables: `CARACAL_API_URL` (default `http://localhost:3000`), `CARACAL_COORDINATOR_URL` (default `http://localhost:4000`), `CARACAL_COORDINATOR_TOKEN` (only required for the agents view), `CARACAL_ZONE_ID` (or set `zone_id` in `caracal.toml`). Inside the TUI: `j`/`k` or arrows to move, `Enter` to drill in, `h`/`Esc` to go back, `r` to reload, `p` to pause the audit tail, `d` to cycle the decision filter, `q` to quit.

Skip installing the TUI by piping the installer with `CARACAL_SKIP_TUI=1`.

### Develop from source

For contributing, building from source, and running the stack against local code, see [CONTRIBUTING.md](CONTRIBUTING.md).

-----

## Maintainers

<table width="100%">
  <tr align="center">
    <td valign="top" width="33%">
      <a href="https://github.com/RAWx18" target="_blank">
        <img src="https://avatars.githubusercontent.com/RAWx18?s=150" width="120" alt="RAWx18"/><br/>
        <strong>RAWx18</strong>
      </a>
      <p>
        <a href="https://github.com/RAWx18" target="_blank">
          <img src="https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white" alt="GitHub"/>
        </a>
        <a href="https://linkedin.com/in/ryanmadhuwala" target="_blank">
          <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn"/>
        </a>
      </p>
    </td>
    <td valign="top" width="33%">
      <a href="https://github.com/yashgo0018" target="_blank">
        <img src="https://avatars.githubusercontent.com/yashgo0018?s=150" width="120" alt="yashgo0018"/><br/>
        <strong>yashgo0018</strong>
      </a>
      <p>
        <a href="https://github.com/yashgo0018" target="_blank">
          <img src="https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white" alt="GitHub"/>
        </a>
        <a href="https://www.linkedin.com/in/yash-goyal-0018" target="_blank">
          <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn"/>
        </a>
      </p>
    </td>
    <td valign="top" width="33%">
      <a href="https://github.com/Slo-Pix" target="_blank">
        <img src="https://avatars.githubusercontent.com/Slo-Pix?s=150" width="120" alt="Slo-Pix"/><br/>
        <strong>Slo-Pix</strong>
      </a>
      <p>
        <a href="https://github.com/Slo-Pix" target="_blank">
          <img src="https://img.shields.io/badge/GitHub-100000?style=flat&logo=github&logoColor=white" alt="GitHub"/>
        </a>
        <a href="https://www.linkedin.com/in/shubh465" target="_blank">
          <img src="https://img.shields.io/badge/LinkedIn-0077B5?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn"/>
        </a>
      </p>
    </td>
  </tr>
</table>

-----

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, tests, and pull request standards.

-----

## Programs

<div align="center">
  <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap;justify-content:center;max-width:960px;">
    <a href="https://mentorship.lfx.linuxfoundation.org/project/9cfe285b-7006-4610-84a8-1a52b0dff662" target="_blank" rel="noopener">
      <img src="public/lfx-mentorship.png" alt="LFX Mentorship 2026" width="90" />
    </a>
    <div style="max-width:520px;text-align:left;">
      <p style="margin:0;">This project is part of the <a href="https://mentorship.lfx.linuxfoundation.org/project/9cfe285b-7006-4610-84a8-1a52b0dff662" target="_blank" rel="noopener">LFX Mentorship 2026</a> program under the <a href="https://www.lfdecentralizedtrust.org" target="_blank" rel="noopener">LF Decentralized Trust</a> organization, improving security and open source awareness.</p>
    </div>
  </div>
</div>

-----

## License

Caracal is open-source software licensed under the **Apache-2.0** License. See the [LICENSE](LICENSE) file for details.

**Developed by Garudex Labs.**
