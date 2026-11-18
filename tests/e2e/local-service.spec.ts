import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let service: ChildProcess;
const origin = `chrome-extension://${"a".repeat(32)}`;
const baseURL = "http://127.0.0.1:4329";
const redirectURI = "http://localhost:4329/oauth/callback";

test.beforeAll(async () => {
  service = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "4329", ALLOWED_EXTENSION_ID: "a".repeat(32), TOKEN_ENCRYPTION_KEY: "a".repeat(64), DATA_DIRECTORY: mkdtempSync(join(tmpdir(), "bns-http-test-")), NOTION_CLIENT_ID: "test-client-id", NOTION_CLIENT_SECRET: "test-client-secret", NOTION_REDIRECT_URI: redirectURI },
  });
  await new Promise<void>((resolve, reject) => {
    let startupErrors = "";
    const timeout = setTimeout(() => reject(new Error(`Test service did not start: ${startupErrors}`)), 15_000);
    service.stderr!.on("data", (data: Buffer) => { startupErrors += data.toString(); });
    service.once("error", error => { clearTimeout(timeout); reject(error); });
    service.once("exit", code => { clearTimeout(timeout); reject(new Error(`Test service exited (${code}): ${startupErrors}`)); });
    service.stdout!.on("data", (data: Buffer) => { if (data.toString().includes("Browser to Notion service:")) { clearTimeout(timeout); resolve(); } });
  });
});
test.afterAll(() => { service?.kill(); });

test("local service accepts only its configured extension and requires a session", async ({ request }) => {
  const blocked = await request.post(`${baseURL}/v1/auth/start`, { headers: { Origin: "https://untrusted.example" }, data: { challenge: "a".repeat(43) } });
  expect(blocked.status()).toBe(403);
  const unauthenticated = await request.post(`${baseURL}/v1/destinations`, { headers: { Origin: origin }, data: { link: "https://www.notion.so/example" } });
  expect(unauthenticated.status()).toBe(401);
  const start = await request.post(`${baseURL}/v1/auth/start`, { headers: { Origin: origin }, data: { challenge: "a".repeat(43) } });
  expect(start.status()).toBe(200);
  const authorization = new URL((await start.json() as { url: string }).url);
  expect(authorization.origin).toBe("https://api.notion.com");
  expect(authorization.searchParams.get("client_id")).toBe("test-client-id");
  expect(authorization.searchParams.get("redirect_uri")).toBe(redirectURI);
  expect(authorization.searchParams.has("client_secret")).toBe(false);
  const denial = await request.get(`${redirectURI}?state=${authorization.searchParams.get("state")}&error=access_denied`, { maxRedirects: 0 });
  expect(denial.status()).toBe(302);
  expect(new URL(denial.headers().location).origin).toBe(`https://${"a".repeat(32)}.chromiumapp.org`);
  const replay = await request.get(`${baseURL}/oauth/callback?state=${authorization.searchParams.get("state")}&error=access_denied`, { maxRedirects: 0 });
  expect(replay.status()).toBe(400);
});

test("invalid callback state and exchange tickets cannot authorize a session", async ({ request }) => {
  const callback = await request.get(`${baseURL}/oauth/callback?state=not-a-flow&code=not-a-code`);
  expect(callback.status()).toBe(400);
  const exchange = await request.post(`${baseURL}/v1/auth/exchange`, { headers: { Origin: origin }, data: { ticket: "a".repeat(43), verifier: "b".repeat(43) } });
  expect(exchange.status()).toBe(401);
});
