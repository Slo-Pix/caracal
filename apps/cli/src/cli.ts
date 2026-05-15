// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// `caracal-cli`: administrative, runtime, and observability commands for the Caracal control plane, dispatched through a strict whitelist registry.

import '@caracalai/engine/scrubCwdEnv'
import { runCommand } from './commands/run.ts'
import { credentialReadCommand } from './commands/credential.ts'
import { zoneCommand } from './commands/zone.ts'
import { appCommand } from './commands/app.ts'
import { resourceCommand } from './commands/resource.ts'
import { providerCommand } from './commands/provider.ts'
import { grantCommand } from './commands/grant.ts'
import { policyCommand, policySetCommand } from './commands/policy.ts'
import { sessionCommand } from './commands/session.ts'
import { auditCommand, explainCommand } from './commands/audit.ts'
import { agentCommand, delegationCommand } from './commands/agent.ts'
import { completionCommand } from './commands/completion.ts'
import { checkMcpGovernance } from './mcp.ts'
import { printError } from './style.ts'
import { CARACAL_MODE, CARACAL_VERSION } from './runtime/version.ts'
import { CLI_COMMANDS } from '@caracalai/core/commands'
import { buildRegistry, type Executor } from './registry.ts'
import { dispatch } from './dispatcher.ts'

const executors: Record<string, Executor> = {
  run: (argv, cfg) => {
    const cmdArgs = argv[0] === '--' ? argv.slice(1) : argv
    if (cmdArgs.length > 0) checkMcpGovernance(cmdArgs, cfg!)
    return runCommand([...argv], cfg!)
  },
  credential: (argv, cfg) => {
    if (argv[0] !== 'read') {
      printError(`unknown subcommand for 'credential': expected 'read'`)
      process.exit(1)
    }
    return credentialReadCommand(argv[1] ?? '', cfg!)
  },
  zone: (argv, cfg) => zoneCommand([...argv], cfg),
  app: (argv, cfg) => appCommand([...argv], cfg),
  resource: (argv, cfg) => resourceCommand([...argv], cfg),
  provider: (argv, cfg) => providerCommand([...argv], cfg),
  policy: (argv, cfg) => policyCommand([...argv], cfg),
  'policy-set': (argv, cfg) => policySetCommand([...argv], cfg),
  grant: (argv, cfg) => grantCommand([...argv], cfg),
  session: (argv, cfg) => sessionCommand([...argv], cfg),
  audit: (argv, cfg) => auditCommand([...argv], cfg),
  explain: (argv, cfg) => explainCommand([...argv], cfg),
  agent: (argv, cfg) => agentCommand([...argv], cfg),
  delegation: (argv, cfg) => delegationCommand([...argv], cfg),
  completion: (argv) => completionCommand([...argv]),
}

const registry = buildRegistry(CLI_COMMANDS, executors)

await dispatch(
  {
    binary: 'caracal-cli',
    version: CARACAL_VERSION,
    mode: CARACAL_MODE,
    registry,
    loadConfig: true,
    extras: [
      '  --zone <id>              Zone selector (default: zone_id from caracal.toml or $CARACAL_ZONE_ID)',
      '  --json                   Emit JSON instead of a table',
    ],
  },
  process.argv.slice(2),
)
