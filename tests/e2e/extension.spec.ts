import { test, expect, chromium } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { initialState, type AppState } from "../../shared/schema";

test("the installed extension captures real bookmark events and retains work across a worker restart", async () => {
  const extensionPath = resolve("dist");
  const profile = mkdtempSync(join(tmpdir(), "bns-extension-test-"));
  const context = await chromium.launchPersistentContext(profile, {
    channel: "msedge", headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    const seed = initialState();
    seed.connection = { token: "isolated-test-session", workspaceId: "test", workspaceName: "Isolated test workspace" };
    seed.paused = true;
    const folderId = await page.evaluate(async state => {
      await chrome.storage.local.set({ state });
      const folder = await chrome.bookmarks.create({ title: "Pilot test folder" });
      await chrome.bookmarks.create({ parentId: folder.id, title: "Existing bookmark", url: "https://example.com/existing" });
      return folder.id;
    }, seed);
    await page.evaluate(async id => {
      const response: { ok: boolean; error?: string } = await chrome.runtime.sendMessage({
        type: "configure", scope: { mode: "selected", folderIds: [id] }, importExisting: false, discardPending: false,
        destination: { id: "test-destination", name: "Test collection", url: "https://www.notion.so/example", mapping: { titleId: "title", urlId: "url" }, properties: [] },
      });
      if (!response.ok) throw new Error(response.error);
    }, folderId);
    await expect.poll(async () => page.evaluate(async () => ((await chrome.storage.local.get("state")).state as AppState).jobs.length)).toBe(0);
    await page.evaluate(async id => { await chrome.bookmarks.create({ parentId: id, title: "New real bookmark", url: "https://example.com/new" }); }, folderId);
    await expect.poll(async () => page.evaluate(async () => ((await chrome.storage.local.get("state")).state as AppState).jobs[0]?.bookmark.title)).toBe("New real bookmark");
    const devtools = await context.newCDPSession(page);
    await devtools.send("ServiceWorker.enable");
    await devtools.send("ServiceWorker.stopAllWorkers");
    await page.reload();
    await page.goto(`chrome-extension://${extensionId}/options.html#activity`);
    await expect(page.getByText("New real bookmark", { exact: true })).toBeVisible();
    await expect(page.getByText("Existing bookmark", { exact: true })).not.toBeVisible();
    await page.screenshot({ path: "test-results/real-extension-activity.png", fullPage: true });
    const stored = await page.evaluate(async () => (await chrome.storage.local.get("state")).state as AppState);
    expect(stored.jobs).toHaveLength(1);
    expect(stored.jobs[0].status).toBe("queued");
    expect(stored.paused).toBe(true);
  } finally { await context.close(); }
});
