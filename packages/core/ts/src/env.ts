// Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
// Caracal, a product of Garudex Labs
//
// Shared environment classification for TypeScript services.

export type CaracalMode = 'dev' | 'runtime';

export function caracalMode(): CaracalMode {
  const raw = (process.env.CARACAL_MODE ?? '').trim().toLowerCase();
  if (raw === '' || raw === 'runtime') return 'runtime';
  if (raw === 'dev') return 'dev';
  throw new Error(`CARACAL_MODE must be 'dev' or 'runtime' (got '${raw}')`);
}

export function isRuntime(): boolean {
  return caracalMode() === 'runtime';
}

export function assertRuntimeSafe(): void {
  if (caracalMode() !== 'runtime') return;
  const forbidden = ['INSECURE_STS', 'INSECURE_HTTP'];
  const set = forbidden.filter((k) => {
    const v = (process.env[k] ?? '').toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  });
  if (set.length > 0) {
    throw new Error(`CARACAL_MODE=runtime forbids: ${set.join(', ')}`);
  }
}
