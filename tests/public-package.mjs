/* global chrome, Headers, Response */
import { chromium,expect } from "@playwright/test";
import { mkdirSync,mkdtempSync,readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { initialState } from "../shared/schema.ts";

const directory=resolve(process.argv[2] || "dist-public");
const connection=JSON.parse(readFileSync(join(directory,"connection.json"),"utf8"));
const destination={ id: "test-source",name: "Public routing check",url: "https://www.notion.so/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",properties: [{ id: "title",name: "Name",type: "title",options: [] },{ id: "url",name: "URL",type: "url",options: [] }] };
const context=await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(),"bns-public-routing-")),{ channel: "msedge",headless: true,ignoreDefaultArgs: ["--disable-extensions"],args: [`--disable-extensions-except=${directory}`,`--load-extension=${directory}`] });
let page;
try {
  const worker=context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  // Installation writes the initial state asynchronously; wait before seeding the isolated test.
  await expect.poll(async () => worker.evaluate(async () => (await chrome.storage.local.get("state")).state?.version)).toBe(1);
  const seed=initialState();
  seed.connection={ token: "isolated-public-test-session",workspaceId: "test",workspaceName: "Public package check" };
  seed.draft.step=1; seed.draft.setupMethod="existing";
  await worker.evaluate(async ({ state,serviceUrl,destination }) => {
    globalThis.bnsRequests=[];
    globalThis.fetch=async (input,init) => {
      const url=String(input);
      globalThis.bnsRequests.push({ url,authorization: new Headers(init?.headers).get("authorization"),body: JSON.parse(String(init?.body)) });
      if (url===`${serviceUrl}/v1/destinations`) return Response.json([destination]);
      if (url===`${serviceUrl}/v1/sync`) return Response.json({ status: "saved",pageId: "test-page",pageUrl: "https://www.notion.so/test-page" });
      if (url===`${serviceUrl}/v1/analytics`) return Response.json({ ok: true });
      throw new Error("Unexpected request in isolated package check");
    };
    await chrome.storage.local.set({ state });
  },{ state: seed,serviceUrl: connection.serviceUrl,destination });
  page=await context.newPage();
  await page.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  await expect(page.getByRole("complementary",{ name: "Design preview" })).toHaveCount(0);
  await page.getByLabel("Notion destination link").fill(destination.url);
  await page.getByRole("button",{ name: "Check link" }).click();
  await expect(page.getByText(destination.name,{ exact: true })).toBeVisible();
  await page.getByRole("button",{ name: "Continue",exact: true }).click();
  await page.getByRole("radio",{ name: "All bookmark folders" }).click();
  await page.getByRole("button",{ name: "Continue",exact: true }).click();
  await expect(page.getByRole("checkbox",{ name: "Share optional usage data" })).not.toBeChecked();
  await page.getByRole("button",{ name: "Enable sync",exact: true }).click();
  await page.evaluate(async () => { await chrome.bookmarks.create({ title: "Public routing bookmark",url: "https://example.com/public-routing" }); });
  await expect.poll(async () => page.evaluate(async () => (await chrome.storage.local.get("state")).state.jobs.find(job => job.bookmark.title==="Public routing bookmark")?.status)).toBe("saved");
  const requests=await worker.evaluate(() => globalThis.bnsRequests);
  expect(requests.map(item => item.url)).toContain(`${connection.serviceUrl}/v1/destinations`);
  expect(requests.map(item => item.url)).toContain(`${connection.serviceUrl}/v1/sync`);
  expect(requests.every(item => item.authorization==="Bearer isolated-public-test-session")).toBe(true);
  expect(requests.some(item => item.url.endsWith("/v1/analytics"))).toBe(false);
  await page.getByRole("checkbox",{ name: "Share optional usage data" }).click();
  await expect(page.getByRole("checkbox",{ name: "Share optional usage data" })).toBeChecked();
  await expect.poll(async () => worker.evaluate(() => globalThis.bnsRequests.filter(item => item.url.endsWith("/v1/analytics")).length)).toBeGreaterThan(0);
  const telemetry=await worker.evaluate(() => globalThis.bnsRequests.find(item => item.url.endsWith("/v1/analytics")).body);
  expect(telemetry.consent).toBe(true);
  expect(JSON.stringify(telemetry)).not.toMatch(/Public routing|example\.com|test-source|test-session|test-page/);
  await page.getByRole("checkbox",{ name: "Share optional usage data" }).click();
  await expect(page.getByRole("checkbox",{ name: "Share optional usage data" })).not.toBeChecked();
  await expect.poll(async () => worker.evaluate(async () => (await chrome.storage.local.get("state")).state.usage.enabled)).toBe(false);
  await page.getByRole("button",{ name: "Pause sync",exact: true }).click();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get("state")).state.usage.queue.length)).toBe(0);
  await page.getByRole("button",{ name: "Privacy",exact: true }).click();
  await context.route(connection.privacyUrl,route => route.fulfill({ contentType: "text/html",body: "<!doctype html><title>Public privacy policy</title><h1>Policy check</h1>" }));
  const opened=context.waitForEvent("page");
  await page.getByRole("button",{ name: "Read the privacy policy" }).click();
  await expect(await opened).toHaveURL(connection.privacyUrl);
  console.info("Public package passed: prefixed routes, real bookmark capture, analytics off by default, explicit opt-in and opt-out, content-free payload, separate privacy URL, and no sample banner. All service calls were intercepted.");
} catch (error) {
  if (page) {
    mkdirSync("test-results",{ recursive: true });
    await page.screenshot({ path: "test-results/public-package-failure.png",fullPage: true }).catch(() => undefined);
    console.error("Isolated package screen:",await page.locator("body").innerText().catch(() => "unavailable"));
  }
  throw error;
} finally { await context.close(); }
