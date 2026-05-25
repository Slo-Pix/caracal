// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Minimal agent example that verifies Caracal injected a resource token.

const token = process.env.RESOURCE_TOKEN

if (!token) {
  process.stderr.write('RESOURCE_TOKEN is not set; run this example through `pnpm caracal run -- node examples/agent.js`.\n')
  process.exitCode = 1
} else {
  process.stdout.write('RESOURCE_TOKEN injected\n')
}
