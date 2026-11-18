import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConfiguredDestination, SyncRequest } from "../../shared/schema";

process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
process.env.ALLOWED_EXTENSION_ID = "a".repeat(32);
process.env.DATA_DIRECTORY = mkdtempSync(join(tmpdir(), "bns-unit-"));
const { db, encrypt } = await import("../../server/database");
const { syncBookmark } = await import("../../server/sync");
const { notionId } = await import("../../server/notion");
const destination: ConfiguredDestination = { id: "source", name: "Reading", url: "https://www.notion.so/example", mapping: { titleId: "title", urlId: "url" }, properties: [{ id: "title", name: "Name", type: "title", options: [] }, { id: "url", name: "URL", type: "url", options: [] }] };
const connection = { id: "owner", workspace_id: "workspace", workspace_name: "Test", encrypted_tokens: encrypt({ access_token: "test-token" }) };
let pages: { id: string; url: string; properties: { URL: { type: string; url: string } } }[];
let creates: number;
let failWrite: boolean;
const makeRequest = (): SyncRequest => ({ operationId: crypto.randomUUID(), bookmark: { id: "bookmark", title: "Resource", url: "https://example.com/article", folderPath: "Reading", dateAdded: 123 }, destination });

beforeAll(() => { expect(process.env.DATA_DIRECTORY).toContain("bns-unit-"); });
beforeEach(() => {
  db.exec("DELETE FROM bns_operations"); pages = []; creates = 0; failWrite = false;
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/data_sources/source")) return Response.json({ id: "source", properties: { Name: { id: "title", name: "Name", type: "title" }, URL: { id: "url", name: "URL", type: "url" } } });
    if (url.endsWith("/query")) return Response.json({ results: pages, has_more: false, next_cursor: null });
    if (url.endsWith("/pages")) {
      creates++;
      if (failWrite) throw new TypeError("Network response lost");
      const page = { id: "page", url: "https://www.notion.so/page", properties: { URL: { type: "url", url: "https://example.com/article" } } };
      pages.push(page); return Response.json(page);
    }
    throw new Error("Unexpected upstream request");
  }));
});
afterAll(() => { db.close(); });

describe("Notion save boundary", () => {
  it("creates once and returns the previous result when an operation is replayed", async () => {
    const request = makeRequest();
    expect((await syncBookmark(connection, request)).status).toBe("saved");
    expect((await syncBookmark(connection, request)).status).toBe("saved");
    expect(creates).toBe(1);
  });
  it("deduplicates a different bookmark with the same destination URL", async () => {
    await syncBookmark(connection, makeRequest());
    expect((await syncBookmark(connection, makeRequest())).status).toBe("duplicate"); expect(creates).toBe(1);
  });
  it("retains an ambiguous write and does not create again when it is still absent", async () => {
    failWrite = true; const request = makeRequest();
    await expect(syncBookmark(connection, request)).rejects.toThrow("could not be reached");
    failWrite = false;
    await expect(syncBookmark(connection, request)).rejects.toThrow("previous save may have reached");
    expect(creates).toBe(1);
  });
  it("reconciles an ambiguous write when the Notion entry becomes visible", async () => {
    failWrite = true; const request = makeRequest();
    await expect(syncBookmark(connection, request)).rejects.toThrow();
    pages.push({ id: "eventual", url: "https://www.notion.so/eventual", properties: { URL: { type: "url", url: request.bookmark.url } } });
    expect((await syncBookmark(connection, request)).pageId).toBe("eventual"); expect(creates).toBe(1);
  });
  it("rejects unsupported schemes before contacting Notion", async () => {
    const request = makeRequest(); request.bookmark.url = "file:///private.txt";
    await expect(syncBookmark(connection, request)).rejects.toThrow("HTTP and HTTPS"); expect(fetch).not.toHaveBeenCalled();
  });
  it("never writes bookmarks into the public original template", async () => {
    const request = makeRequest(); request.destination = { ...request.destination, id: "41ccff4f-3d6d-8108-999d-000beb58e73e" };
    await expect(syncBookmark(connection, request)).rejects.toThrow("public starter template cannot receive bookmarks");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("validates Notion hosts rather than fetching arbitrary pasted URLs", () => {
    expect(notionId("https://www.notion.so/Reading-0123456789abcdef0123456789abcdef?v=abc")).toBe("0123456789abcdef0123456789abcdef");
    expect(() => notionId("https://notion.so.attacker.example/0123456789abcdef0123456789abcdef")).toThrow("HTTPS Notion");
  });
});
