import type { Bookmark, FolderNode, Scope } from "../../shared/schema.ts";

export interface BookmarkNode {
  id: string; title: string; url?: string; dateAdded?: number; children?: BookmarkNode[];
}
export interface BookmarkSnapshot { bookmark: Bookmark; eligible: boolean }

export function normalizeUrl(raw: string): string | undefined {
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.href : undefined; }
  catch { return undefined; }
}

/** Inclusion follows folder identity, so renaming or moving a selected root is safe. */
export function flattenBookmarks(tree: BookmarkNode[], scope: Scope): BookmarkSnapshot[] {
  const result: BookmarkSnapshot[] = [];
  const visit = (nodes: BookmarkNode[], path: string[], inherited: boolean) => {
    for (const node of nodes) {
      if (node.url !== undefined) {
        result.push({ eligible: inherited, bookmark: {
          id: node.id, title: node.title || safeTitle(node.url), url: node.url,
          folderPath: path.join(" > "), dateAdded: node.dateAdded ?? Date.now(),
        } });
      } else {
        const nextPath = node.id === "0" ? path : [...path, node.title || "Untitled folder"];
        visit(node.children ?? [], nextPath, inherited || scope.folderIds.includes(node.id));
      }
    }
  };
  visit(tree, [], scope.mode === "all");
  return result;
}

export function folderTree(tree: BookmarkNode[]): FolderNode[] {
  const visit = (node: BookmarkNode): FolderNode[] => {
    if (node.url !== undefined) return [];
    const children = (node.children ?? []).flatMap(visit);
    if (node.id === "0") return children;
    const count = (nodes: BookmarkNode[]): number => nodes.reduce((sum, child) => sum + (child.url !== undefined ? 1 : count(child.children ?? [])), 0);
    return [{ id: node.id, title: node.title || "Untitled folder", children, bookmarkCount: count(node.children ?? []) }];
  };
  return tree.flatMap(visit);
}

function safeTitle(url: string) { try { return new URL(url).hostname; } catch { return url; } }
