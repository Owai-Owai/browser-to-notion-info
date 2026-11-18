import { describe, expect, it } from "vitest";
import { suggestMapping } from "../../src/lib/property-mapping";
import { isOriginalTemplateId, isOriginalTemplateLink, notionTemplate } from "../../shared/notion-template";
import { appStateSchema, initialState, type Destination } from "../../shared/schema";

const copy: Destination = { id: "my-copy", name: "Bookmarks", url: "https://www.notion.so/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", properties: [
  { id: "copy-title", name: "Name", type: "title", options: [] },
  { id: "copy-url", name: "URL", type: "url", options: [] },
  { id: "copy-folder", name: "Bookmark Folder", type: "rich_text", options: [] },
  { id: "copy-date", name: "Bookmarked At", type: "date", options: [] },
  { id: "copy-status", name: "Status", type: "status", options: [{ id: "copy-unread", name: "To read" }, { id: "copy-reading", name: "Reading" }, { id: "copy-read", name: "Read" }] },
] };

describe("template setup", () => {
  it("matches all starter fields using the duplicate's own IDs", () => {
    expect(suggestMapping(copy, true)).toEqual({ titleId: "copy-title", urlId: "copy-url", folderId: "copy-folder", dateId: "copy-date", statusId: "copy-status", statusValue: "copy-unread" });
  });
  it("keeps optional properties unset in the existing-database path", () => {
    expect(suggestMapping(copy)).toEqual({ titleId: "copy-title", urlId: "copy-url" });
  });
  it("does not guess a missing or changed optional field", () => {
    const changed = structuredClone(copy); changed.properties[2].type = "select"; changed.properties[4].options = [{ id: "later", name: "Later" }];
    const mapping = suggestMapping(changed, true);
    expect(mapping.folderId).toBeUndefined(); expect(mapping.statusValue).toBeUndefined();
  });
  it("prefers the template's named URL if several URL properties exist", () => {
    const expanded = { ...copy, properties: [...copy.properties, { id: "extra-url", name: "Other URL", type: "url", options: [] }] };
    expect(suggestMapping(expanded).urlId).toBeUndefined();
    expect(suggestMapping(expanded, true).urlId).toBe("copy-url");
  });
  it("starts new users on the template path without invalidating existing saved drafts", () => {
    expect(initialState().draft.setupMethod).toBe("template");
    const oldState = initialState(); delete oldState.draft.setupMethod;
    expect(appStateSchema.parse(oldState).draft.setupMethod).toBeUndefined();
  });
});

describe("public original protection", () => {
  it("rejects template, database, and source URLs despite slug, UUID formatting, or query parameters", () => {
    expect(isOriginalTemplateLink(notionTemplate.url)).toBe(true);
    expect(isOriginalTemplateLink(`https://www.notion.so/${notionTemplate.databaseId}?v=some-view`)).toBe(true);
    expect(isOriginalTemplateId("41ccff4f-3d6d-8108-999d-000beb58e73e")).toBe(true);
  });
  it("accepts a user's duplicate and handles invalid input without throwing", () => {
    expect(isOriginalTemplateLink(copy.url)).toBe(false);
    expect(isOriginalTemplateLink("invalid")).toBe(false);
  });
});
