import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCommand, pump, reconcile } from "../../src/background/engine";
import { initialState, type AppState, type ConfiguredDestination } from "../../shared/schema";
import type { BookmarkNode } from "../../src/lib/bookmarks";

let state: AppState;
let tree: BookmarkNode[];
const destination: ConfiguredDestination = { id: "source", name: "Reading", url: "https://www.notion.so/abc", mapping: { titleId: "title", urlId: "url" }, properties: [{ id: "title", name: "Name", type: "title", options: [] }, { id: "url", name: "URL", type: "url", options: [] }] };
const bookmark = (id: string, url = "https://example.com/article"): BookmarkNode => ({ id, title: "Resource", url, dateAdded: 123 });
const node = (id: string) => tree[0].children!.find(node => node.id === id)!;

beforeEach(() => {
  state = initialState(); state.connection = { token: "test-session", workspaceId: "workspace", workspaceName: "Test" };
  tree = [{ id: "0", title: "", children: [{ id: "10", title: "Selected", children: [bookmark("old")] }, { id: "20", title: "Excluded", children: [bookmark("private", "https://private.example.com")] }] }];
  vi.stubGlobal("chrome", {
    bookmarks: { getTree: async () => structuredClone(tree) },
    storage: { local: { get: async () => ({ state: structuredClone(state) }), set: async (data: { state: AppState }) => { state = structuredClone(data.state); } }, session: { get: async () => ({}), remove: async () => undefined } },
    action: { setBadgeText: async () => undefined, setBadgeBackgroundColor: async () => undefined },
  });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "saved", pageId: "page", pageUrl: "https://www.notion.so/page" })));
});

async function configure() { await handleCommand({ type: "configure", destination, scope: { mode: "selected", folderIds: ["10"] }, importExisting: false, discardPending: false }); }

describe("durable capture", () => {
  it("baselines existing bookmarks and only captures subsequent eligible additions", async () => {
    await configure(); await reconcile(); expect(state.jobs).toHaveLength(0);
    node("10").children!.push(bookmark("new")); node("20").children!.push(bookmark("excluded"));
    await reconcile(); expect(state.jobs.map(job => job.bookmark.id)).toEqual(["new"]);
    await reconcile(); expect(state.jobs).toHaveLength(1);
  });
  it("captures an existing bookmark moved into scope", async () => {
    await configure(); const moved = node("20").children!.pop()!; node("10").children!.push(moved);
    await reconcile(); expect(state.jobs[0].bookmark.id).toBe("private");
  });
  it("cancels an unsent bookmark moved out of scope", async () => {
    await configure(); node("10").children!.push(bookmark("new")); await reconcile();
    node("20").children!.push(node("10").children!.pop()!); await reconcile();
    expect(state.jobs[0].status).toBe("cancelled"); expect(fetch).not.toHaveBeenCalled();
  });
  it("does not mirror edits to an already observed bookmark", async () => {
    await configure(); node("10").children![0].url = "https://example.com/changed"; await reconcile();
    expect(state.jobs).toHaveLength(0);
  });
  it("records unsupported links as skipped", async () => {
    await configure(); node("10").children!.push(bookmark("file", "file:///private")); await reconcile();
    expect(state.jobs[0].status).toBe("skipped");
  });
  it("explicit import keeps its own scope even when automatic capture uses other folders", async () => {
    await configure(); await handleCommand({ type: "import", scope: { mode: "selected", folderIds: ["20"] } }); await reconcile();
    expect(state.jobs[0].status).toBe("queued"); expect(state.jobs[0].bookmark.id).toBe("private");
  });
  it("pause preserves captured work and sends nothing", async () => {
    await configure(); await handleCommand({ type: "pause", paused: true });
    node("10").children!.push(bookmark("new")); await reconcile(); state.jobs[0].retryAt = 0;
    await pump(); expect(state.jobs[0].status).toBe("queued"); expect(fetch).not.toHaveBeenCalled();
  });
  it("resumes a persisted saving record with the same operation ID", async () => {
    await configure(); node("10").children!.push(bookmark("new")); await reconcile();
    state.jobs[0].status = "saving"; state.jobs[0].retryAt = 0;
    const originalId = state.jobs[0].id; await pump();
    expect(state.jobs[0].status).toBe("saved");
    const request = vi.mocked(fetch).mock.calls[0][1];
    expect(JSON.parse(request!.body as string).operationId).toBe(originalId);
  });
  it("respects rate-limit delays and retains the item", async () => {
    await configure(); node("10").children!.push(bookmark("new")); await reconcile(); state.jobs[0].retryAt = 0;
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ code: "rate_limit", message: "Wait", retryAfter: 120 }, { status: 429 }));
    const before = Date.now(); await pump();
    expect(state.jobs[0].status).toBe("retry"); expect(state.jobs[0].retryAt).toBeGreaterThanOrEqual(before + 120_000);
  });
  it("refuses to silently redirect pending work to a new destination", async () => {
    await configure(); node("10").children!.push(bookmark("new")); await reconcile();
    await expect(handleCommand({ type: "configure", destination: { ...destination, id: "other" }, scope: state.scope, importExisting: false, discardPending: false })).rejects.toThrow("previous destination");
    expect(state.jobs[0].destination.id).toBe("source");
  });
  it("repairs pending schema failures when mappings change within the same destination", async () => {
    await configure(); node("10").children!.push(bookmark("new")); await reconcile();
    state.jobs[0].status = "attention"; state.jobs[0].error = { code: "schema", message: "Property changed" };
    const repaired = { ...destination, mapping: { titleId: "title", urlId: "replacement-url" } };
    await handleCommand({ type: "configure", destination: repaired, scope: state.scope, importExisting: false, discardPending: false });
    expect(state.jobs[0].destination.mapping.urlId).toBe("replacement-url");
    expect(state.jobs[0].status).toBe("queued");
  });
  it("clearing completed history preserves queued and failed work", async () => {
    await configure(); node("10").children!.push(bookmark("new")); await reconcile();
    state.jobs.push({ ...structuredClone(state.jobs[0]), id: crypto.randomUUID(), status: "saved" });
    state.jobs.push({ ...structuredClone(state.jobs[0]), id: crypto.randomUUID(), status: "attention" });
    await handleCommand({ type: "clearHistory" });
    expect(state.jobs.map(job => job.status)).toEqual(["queued", "attention"]);
  });
});
