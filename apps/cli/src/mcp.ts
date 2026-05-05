// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// MCP shadow governance: detects unauthorized MCP server processes and blocks or logs.

import type { CliConfig } from './config.ts'

const KNOWN_MCP_INDICATORS = ['mcp-server', 'fastmcp', '@modelcontextprotocol']

export function checkMcpGovernance(cmd: string, cfg: CliConfig): void {
  const isUnauthorized = KNOWN_MCP_INDICATORS.some((ind) => cmd.includes(ind))
  if (!isUnauthorized) return

  const mode = cfg.mcp_governance?.mode ?? 'block'
  if (mode === 'log') {
    process.stderr.write(
      JSON.stringify({ event: 'mcp_governance', action: 'log', cmd }) + '\n',
    )
    return
  }

  process.stderr.write(
    JSON.stringify({ event: 'mcp_governance', action: 'blocked', cmd }) + '\n',
  )
  process.exit(1)
}
