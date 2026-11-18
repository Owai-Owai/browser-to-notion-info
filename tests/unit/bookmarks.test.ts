import { describe, expect, it } from "vitest";
import { flattenBookmarks, folderTree, normalizeUrl, type BookmarkNode } from "../../src/lib/bookmarks";

const tree: BookmarkNode[] = [{ id: "0", title: "", children: [{ id: "1", title: "Bookmarks bar", children: [
  { id: "10", title: "Research", children: [{ id: "11", title: "Design", children: [{ id: "101", title: "A resource", url: "https://example.com/article?q=One#section", dateAdded: 100 }] }] },
  { id: "20", title: "Private", children: [{ id: "201", title: "Private site", url: "https://private.example.com" }] },
] }] }];

describe("bookmark scope", () => {
  it("includes descendants of selected folder IDs without including siblings", () => {
    const result = flattenBookmarks(tree, { mode: "selected", folderIds: ["10"] });
    expect(result.map(item => item.eligible)).toEqual([true, false]);
    expect(result[0].bookmark.folderPath).toBe("Bookmarks bar > Research > Design");
    expect(result[0].bookmark.dateAdded).toBe(100);
  });
  it("keeps a selected folder included after a rename", () => {
    const renamed = structuredClone(tree); renamed[0].children![0].children![0].title = "Renamed";
    expect(flattenBookmarks(renamed, { mode: "selected", folderIds: ["10"] })[0].eligible).toBe(true);
  });
  it("never falls back to all folders when a selected ID is missing", () => {
    expect(flattenBookmarks(tree, { mode: "selected", folderIds: ["missing"] }).some(item => item.eligible)).toBe(false);
  });
  it("produces folder counts without exposing website payloads in the folder picker", () => {
    const folders = folderTree(tree);
    expect(folders[0].bookmarkCount).toBe(2);
    expect(folders[0].children[0].children[0].title).toBe("Design");
    expect(JSON.stringify(folders)).not.toContain("private.example.com");
  });
});

describe("conservative URL identity", () => {
  it("normalizes scheme, host and default port only through URL serialization", () => {
    expect(normalizeUrl("HTTPS://EXAMPLE.COM:443/Article?b=2&a=1#Anchor")).toBe("https://example.com/Article?b=2&a=1#Anchor");
  });
  it("keeps query strings, their order, fragment and path case meaningful", () => {
    expect(normalizeUrl("https://example.com/A?a=1&b=2#one")).not.toBe(normalizeUrl("https://example.com/a?b=2&a=1#two"));
  });
  it.each(["chrome://settings", "file:///C:/private.txt", "javascript:alert(1)", "not a URL"])("skips %s", url => {
    expect(normalizeUrl(url)).toBeUndefined();
  });
});
