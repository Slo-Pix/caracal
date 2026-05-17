/*
 * Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
 * Caracal, a product of Garudex Labs
 *
 * Generic HTTP server middleware: extracts the wire envelope from incoming requests
 * and binds a CaracalContext for the handler scope. Works with Express, Connect,
 * Fastify (via preHandler), and any framework exposing (req, res, next).
 */

import { Caracal, type RootOptions } from "./client.js";

export interface IncomingLike {
  headers: Record<string, string | string[] | undefined>;
}

export type FastifyRequestLike = IncomingLike

export type ConnectMiddleware = (
  req: IncomingLike,
  res: unknown,
  next: (err?: unknown) => void,
) => void;

export function caracalHttpMiddleware(caracal: Caracal, opts: RootOptions = {}): ConnectMiddleware {
  return (req, _res, next) => {
    caracal
      .bindFromHeaders(req.headers, async () => {
        next();
      }, opts)
      .catch(next);
  };
}

export function caracalFastifyHook(caracal: Caracal, opts: RootOptions = {}) {
  return async (req: IncomingLike) => {
    await caracal.bindFromHeaders(req.headers, async () => undefined, opts);
  };
}
