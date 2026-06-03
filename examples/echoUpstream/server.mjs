/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Zero-dependency HTTP echo upstream used as a self-contained protected target for the first Caracal tutorial.
*/

import { createServer } from "node:http";

const PORT = Number(process.env.ECHO_PORT ?? 8088);

export function buildEchoResponse(req, body) {
  return {
    service: "echoUpstream",
    method: req.method,
    path: req.url,
    headers: req.headers,
    body: body.length > 0 ? body : null,
    receivedAt: new Date().toISOString(),
  };
}

export function createEchoServer() {
  return createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (req.url === "/healthz") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: "ok" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(buildEchoResponse(req, body)));
    });
  });
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const server = createEchoServer();
  server.listen(PORT, () => {
    process.stdout.write(`echoUpstream listening on :${PORT}\n`);
  });
}
