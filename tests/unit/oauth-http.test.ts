import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

const reservation = createServer().listen(0, "127.0.0.1");
await once(reservation, "listening");
const address = reservation.address();
if (!address || typeof address === "string") throw new Error("Expected a local test port");
await new Promise<void>(resolve => reservation.close(() => resolve()));
const base = `http://127.0.0.1:${address.port}`;
const origin = `chrome-extension://${"c".repeat(32)}`;
Object.assign(process.env, { PORT: String(address.port), SERVICE_MODE: "local", TRUST_PROXY: "true", CLIENT_IP_HEADER: "cf-connecting-ip", NOTION_CLIENT_ID: "test-id", NOTION_CLIENT_SECRET: "test-secret", TOKEN_ENCRYPTION_KEY: "c".repeat(64), ALLOWED_EXTENSION_ID: "c".repeat(32), DATA_DIRECTORY: mkdtempSync(join(tmpdir(), "bns-oauth-http-")), NOTION_REDIRECT_URI: `${base}/oauth/callback` });
const nativeFetch = globalThis.fetch;
vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
  if (String(input) !== "https://api.notion.com/v1/oauth/token") throw new Error("Unexpected upstream request");
  return Response.json({ access_token: "isolated-notion-token", workspace_id: "same-workspace", workspace_name: "Test workspace" });
}));
const { server } = await import("../../server/index");
const { db, getConnection } = await import("../../server/database");
beforeAll(async () => { if (!server.listening) await once(server, "listening"); });
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); db.close(); vi.unstubAllGlobals(); });

const post = (path: string, body: unknown, token?: string, ip = "192.0.2.1") => nativeFetch(`${base}${path}`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": ip, "X-Forwarded-For": "192.0.2.99, 192.0.2.100", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
async function begin(token?: string, verifier = "v".repeat(43)) {
  const response = await post("/v1/auth/start", { challenge: createHash("sha256").update(verifier).digest("base64url") }, token);
  expect(response.status).toBe(200);
  const authorization = new URL((await response.json() as { url: string }).url);
  const callback = await nativeFetch(`${base}/oauth/callback?state=${authorization.searchParams.get("state")}&code=fake-code`, { redirect: "manual" });
  expect(callback.status).toBe(302);
  const ticket = new URL(callback.headers.get("location")!).searchParams.get("ticket")!;
  return { ticket, verifier, state: authorization.searchParams.get("state")! };
}
async function finish(flow: { ticket: string; verifier: string }) {
  const response = await post("/v1/auth/exchange", flow);
  expect(response.status).toBe(200);
  return (await response.json() as { token: string }).token;
}

describe("public OAuth service behavior", () => {
  it("keeps two installations in one workspace independent through disconnect", async () => {
    const first = await finish(await begin());
    const second = await finish(await begin());
    expect(getConnection(first)?.id).not.toBe(getConnection(second)?.id);
    expect((await post("/v1/disconnect", {}, first)).status).toBe(200);
    expect(getConnection(first)).toBeUndefined();
    expect(getConnection(second)).toBeDefined();
  });
  it("reconnects using the existing session and preserves uncertain save records", async () => {
    const original = await finish(await begin());
    const id = getConnection(original)!.id;
    db.prepare("INSERT INTO bns_operations(owner,operation_id,resource_key,state,updated_at) VALUES(?,?,?,'uncertain',?)").run(id, "in-flight-save", "resource", Date.now());
    const renewed = await finish(await begin(original));
    expect(getConnection(original)).toBeUndefined();
    expect(getConnection(renewed)?.id).toBe(id);
    expect(db.prepare("SELECT state FROM bns_operations WHERE owner = ?").get(id)).toEqual({ state: "uncertain" });
  });
  it("requires the verifier and consumes both callback state and exchange ticket", async () => {
    const flow = await begin();
    expect((await post("/v1/auth/exchange", { ...flow, verifier: "wrong".repeat(10) })).status).toBe(401);
    await finish(flow);
    expect((await post("/v1/auth/exchange", flow)).status).toBe(401);
    expect((await nativeFetch(`${base}/oauth/callback?state=${flow.state}&code=fake-code`, { redirect: "manual" })).status).toBe(400);
  });
  it("limits an abusive client without blocking another client's connection", async () => {
    for (let attempt = 0; attempt < 20; attempt++) expect((await post("/v1/auth/start", { challenge: "a".repeat(43) }, undefined, "192.0.2.20")).status).toBe(200);
    expect((await post("/v1/auth/start", { challenge: "a".repeat(43) }, undefined, "192.0.2.20")).status).toBe(429);
    expect((await post("/v1/auth/start", { challenge: "a".repeat(43) }, undefined, "192.0.2.21")).status).toBe(200);
  });
});
