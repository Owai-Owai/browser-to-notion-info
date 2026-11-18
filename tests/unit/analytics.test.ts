import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsBatchSchema, analyticsTTL, queueUsage } from "../../shared/analytics";
import { appStateSchema, initialState, type AppState } from "../../shared/schema";
import { flushUsage, stopUsageRequest } from "../../src/background/analytics";
import { handleCommand, pump, reconcile } from "../../src/background/engine";

vi.mock("../../src/lib/service-config", () => ({ usageSupported: true, serviceURL: "https://analytics.example.test", usesLocalService: false }));
let state: AppState;
const event = { event: "bns_usage_enabled", properties: { version: "0.1.3" } } as const;
beforeEach(() => {
  state = initialState();
  state.connection = { token: "private-session", workspaceId: "private-workspace", workspaceName: "Private workspace" };
  vi.stubGlobal("chrome", {
    runtime: { getManifest: () => ({ version: "0.1.3" }) },
    bookmarks: { getTree: async () => [{ id: "0", title: "", children: [] }] },
    storage: { local: { get: async () => ({ state: structuredClone(state) }), set: async (data: { state: AppState }) => { state = structuredClone(data.state); } }, session: { get: async () => ({}), remove: async () => undefined } },
    action: { setBadgeText: async () => undefined, setBadgeBackgroundColor: async () => undefined },
  });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
});
afterEach(() => { stopUsageRequest(); vi.unstubAllGlobals(); });

describe("optional product analytics", () => {
  it("defaults both fresh and legacy installations to off and sends nothing", async () => {
    const legacy = { ...initialState(), usage: undefined };
    expect(appStateSchema.parse(legacy).usage.enabled).toBe(false);
    queueUsage(state.usage, event);
    await flushUsage();
    expect(state.usage.queue).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires explicit opt-in, bounds the queue, and rejects arbitrary content", async () => {
    await handleCommand({ type: "usage", enabled: true });
    const id = state.usage.installationId;
    expect(id).toBeTruthy();
    for (let i=0; i<110; i++) queueUsage(state.usage, event);
    expect(state.usage.queue).toHaveLength(100);
    expect(() => queueUsage(state.usage, { ...event, properties: { version: "0.1.3", url: "https://private.test" } } as never)).toThrow();
    expect(() => analyticsBatchSchema.parse({ consent: false, installationId: id, events: state.usage.queue.slice(0,1) })).toThrow();
    await flushUsage();
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string);
    expect(body.events).toHaveLength(25);
    expect(JSON.stringify(body)).not.toMatch(/private|workspace|title|folder|token|url/i);
    expect(state.usage.queue).toHaveLength(75);
  });
  it("clears unsent events on opt-out and retains the deletion ID without re-enabling on restart", async () => {
    await handleCommand({ type: "usage", enabled: true });
    const id = state.usage.installationId;
    await handleCommand({ type: "usage", enabled: false });
    expect(state.usage.queue).toEqual([]);
    expect(state.usage.installationId).toBe(id);
    expect(appStateSchema.parse(state).usage.enabled).toBe(false);
    await flushUsage();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps event IDs stable on retry and backs off on failure", async () => {
    await handleCommand({ type: "usage", enabled: true });
    const id = state.usage.queue[0].id;
    vi.mocked(fetch).mockRejectedValue(new TypeError("offline"));
    await flushUsage();
    expect(state.usage.queue[0].id).toBe(id);
    expect(state.usage.nextAttemptAt).toBeGreaterThan(Date.now());
    await flushUsage();
    expect(fetch).toHaveBeenCalledTimes(1);
    queueUsage(state.usage, event, Date.now()-analyticsTTL-1000);
    await handleCommand({ type: "pause", paused: true });
    expect(state.usage.queue.every(item => Date.parse(item.timestamp)>Date.now()-analyticsTTL)).toBe(true);
  });
  it("aborts an in-flight request when sharing is turned off", async () => {
    await handleCommand({ type: "usage", enabled: true });
    let started!: () => void;
    const ready = new Promise<void>(resolve => { started=resolve; });
    vi.mocked(fetch).mockImplementation(async (_url,init) => new Promise((_resolve,reject) => {
      init!.signal!.addEventListener("abort",() => reject(new Error("aborted")));
      started();
    }));
    const flushing = flushUsage(); await ready;
    await handleCommand({ type: "usage", enabled: false });
    await flushing;
    expect(state.usage.enabled).toBe(false);
    expect(state.usage.queue).toEqual([]);
  });
  it("saves bookmarks despite analytics failure and removes connection state on disconnect", async () => {
    await handleCommand({ type: "usage", enabled: true });
    await handleCommand({ type: "configure", scope: { mode: "all", folderIds: [] }, destination: { id: "private-destination", name: "Private library", url: "https://notion.so/private", properties: [], mapping: { titleId: "title", urlId: "url" } }, importExisting: false, discardPending: false });
    chrome.bookmarks.getTree = async () => [{ id: "0", title: "", syncing: false, children: [{ id: "new", title: "Private title", url: "https://private.example", dateAdded: 123, syncing: false }] }];
    await reconcile();
    state.jobs[0].retryAt = 0;
    vi.mocked(fetch).mockImplementation(async url => {
      if (String(url).endsWith("/v1/analytics")) throw new TypeError("analytics unavailable");
      return Response.json({ status: "saved", pageId: "private-page", pageUrl: "https://notion.so/private-page" });
    });
    await pump(); await flushUsage();
    expect(state.jobs[0].status).toBe("saved");
    expect(JSON.stringify(state.usage.queue)).not.toMatch(/Private|private\.example|private-page|private-destination/);
    vi.mocked(fetch).mockResolvedValue(Response.json({ ok: true }));
    await handleCommand({ type: "disconnect" });
    expect(state.connection).toBeUndefined(); expect(state.destination).toBeUndefined();
    expect(state.usage).toEqual(initialState().usage);
  });
});
