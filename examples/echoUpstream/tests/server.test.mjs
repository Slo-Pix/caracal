/*
Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
Caracal, a product of Garudex Labs

Offline tests for the echo upstream request handler and health endpoint.
*/

import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { buildEchoResponse, createEchoServer } from "../server.mjs";

test("buildEchoResponse reflects method, path and body", () => {
  const req = { method: "POST", url: "/v1/things", headers: { "x-caracal-resource": "resource://pipernet" } };
  const out = buildEchoResponse(req, "hello");
  assert.equal(out.service, "echoUpstream");
  assert.equal(out.method, "POST");
  assert.equal(out.path, "/v1/things");
  assert.equal(out.body, "hello");
  assert.equal(out.headers["x-caracal-resource"], "resource://pipernet");
});

test("buildEchoResponse returns null body when empty", () => {
  const req = { method: "GET", url: "/", headers: {} };
  const out = buildEchoResponse(req, "");
  assert.equal(out.body, null);
});

test("server echoes requests and serves health", async () => {
  const server = createEchoServer();
  server.listen(0);
  await once(server, "listening");
  const port = server.address().port;
  try {
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const echoed = await fetch(`http://127.0.0.1:${port}/orders`, {
      method: "POST",
      body: "payload",
    });
    const json = await echoed.json();
    assert.equal(json.method, "POST");
    assert.equal(json.path, "/orders");
    assert.equal(json.body, "payload");
  } finally {
    server.close();
    await once(server, "close");
  }
});
