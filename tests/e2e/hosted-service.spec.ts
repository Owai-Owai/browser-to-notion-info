import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let service: ChildProcess;
const localURL = "http://127.0.0.1:4330";
const host = "bookmark-service.example.test";
const extensionId = "d".repeat(32);

test.beforeAll(async () => {
  service = spawn(process.execPath, ["build-service/index.mjs"], {
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: "4330", SERVICE_MODE: "hosted", SERVICE_PUBLIC_URL: `https://${host}`, NOTION_REDIRECT_URI: `https://${host}/oauth/callback`, ALLOWED_EXTENSION_ID: extensionId, TOKEN_ENCRYPTION_KEY: "d".repeat(64), NOTION_CLIENT_ID: "test-client", NOTION_CLIENT_SECRET: "test-secret", PUBLISHER_NAME: "Test publisher", SUPPORT_EMAIL: "support@example.test", DATA_DIRECTORY: mkdtempSync(join(tmpdir(), "bns-hosted-test-")) },
  });
  await new Promise<void>((resolve, reject) => {
    let errors = "";
    const timeout = setTimeout(() => reject(new Error(`Hosted test service did not start: ${errors}`)), 15_000);
    service.stderr!.on("data", (chunk: Buffer) => { errors += chunk.toString(); });
    service.once("error", error => { clearTimeout(timeout); reject(error); });
    service.once("exit", code => { clearTimeout(timeout); reject(new Error(`Hosted test service exited (${code}): ${errors}`)); });
    service.stdout!.on("data", (chunk: Buffer) => { if (chunk.toString().includes("Browser to Notion service:")) { clearTimeout(timeout); resolve(); } });
  });
});
test.afterAll(() => service?.kill());

test("the compiled hosted service serves health and a public privacy policy", async ({ request }) => {
  const health = await request.get(`${localURL}/healthz`, { headers: { Host: host } });
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ ok: true, mode: "hosted", extensionId });
  const privacy = await request.get(`${localURL}/privacy`, { headers: { Host: host } });
  expect(privacy.status()).toBe(200);
  expect(privacy.headers()["strict-transport-security"]).toBe("max-age=31536000");
  const text = await privacy.text();
  expect(text).toContain("Test publisher");
  expect(text).toContain("mailto:support@example.test");
  expect(text).toContain("Render");
  expect(text).not.toContain("test-secret");
  expect(text).not.toContain(".env.local");
});

test("the hosted service enforces its host and extension and uses its HTTPS OAuth callback", async ({ request }) => {
  const wrongHost = await request.get(`${localURL}/healthz`);
  expect(wrongHost.status()).toBe(403);
  const blocked = await request.post(`${localURL}/v1/auth/start`, { headers: { Host: host, Origin: "https://untrusted.example" }, data: { challenge: "a".repeat(43) } });
  expect(blocked.status()).toBe(403);
  const start = await request.post(`${localURL}/v1/auth/start`, { headers: { Host: host, Origin: `chrome-extension://${extensionId}` }, data: { challenge: "a".repeat(43) } });
  expect(start.status()).toBe(200);
  const authorize = new URL((await start.json() as { url: string }).url);
  expect(authorize.searchParams.get("redirect_uri")).toBe(`https://${host}/oauth/callback`);
  expect(authorize.searchParams.has("client_secret")).toBe(false);
});
