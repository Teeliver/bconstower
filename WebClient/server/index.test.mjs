import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import WebSocket from "ws";
import { createGateway, loadConfig, allowedOrigin } from "./index.mjs";

test("WebSocket permits the same origin and local Vite, rejects foreign or missing origins", () => {
  const request = (origin) => ({
    headers: { host: "127.0.0.1:3001", ...(origin ? { origin } : {}) },
  });
  assert.equal(allowedOrigin(request("http://127.0.0.1:3001")), true);
  assert.equal(allowedOrigin(request("http://localhost:5173")), true);
  assert.equal(allowedOrigin(request("http://127.0.0.1:5173")), true);
  assert.equal(allowedOrigin(request("https://example.com")), false);
  assert.equal(allowedOrigin(request("http://localhost:5174")), false);
  assert.equal(allowedOrigin(request()), false);
  assert.equal(allowedOrigin(request("null")), false);
});

test("HTTP gateway exposes safe configuration, serves builds, and enforces WebSocket origin", async (t) => {
  const staticRoot = await mkdtemp(resolve(tmpdir(), "mu-web-static-"));
  await writeFile(
    resolve(staticRoot, "index.html"),
    "<!doctype html><title>MU</title>",
  );
  const gateway = createGateway({ ...loadConfig(), port: 0, staticRoot });
  t.after(async () => {
    await gateway.close();
    await rm(staticRoot, { recursive: true, force: true });
  });
  const address = await gateway.listen();
  const origin = `http://127.0.0.1:${address.port}`;
  const health = await (await fetch(`${origin}/api/health`)).json();
  assert.equal(health.gatewayAvailable, true);
  assert.equal(health.activeSessions, 0);
  assert.equal(typeof health.tls.validNow, "boolean");
  const configuration = await (await fetch(`${origin}/api/config`)).json();
  assert.equal(configuration.capabilities.movement, false);
  assert.equal(configuration.capabilities.combat, false);
  assert.equal(configuration.classes.length, 7);
  assert.equal("serial" in configuration, false);
  assert.equal("caFile" in configuration, false);
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>MU<\/title>/);
  assert.equal((await fetch(`${origin}/%2eprivate`)).status, 403);
  assert.equal(
    (await fetch(`${origin}/api/config`, { method: "POST" })).status,
    405,
  );

  await new Promise((resolveRejected, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, {
      origin: "https://example.com",
    });
    ws.once("open", () => {
      ws.close();
      reject(new Error("Foreign origin was accepted"));
    });
    ws.once("error", (error) => {
      assert.match(error.message, /403/);
      resolveRejected();
    });
  });
  const ws = new WebSocket(`ws://127.0.0.1:${address.port}/ws`, { origin });
  const response = await new Promise((resolveMessage, reject) => {
    ws.once("error", reject);
    ws.once("message", (data) => resolveMessage(JSON.parse(data.toString())));
  });
  assert.equal(response.type, "status");
  assert.equal(response.phase, "idle");
  assert.equal(gateway.sessions.size, 1);
  await new Promise((resolveClosed) => {
    ws.once("close", resolveClosed);
    ws.close();
  });
});
