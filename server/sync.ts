import { db, hash, type StoredConnection } from "./database";
import { ApiError, createPage, findPages, validateMapping } from "./notion";
import { normalizeUrl } from "../src/lib/bookmarks";
import type { SyncRequest, SyncResult } from "../shared/schema";
import { isOriginalTemplateId } from "../shared/notion-template";

const locks = new Set<string>();
interface Operation { state: string; page_id: string | null; page_url: string | null }

/** An uncertain write is queried again, never automatically repeated. */
export async function syncBookmark(connection: StoredConnection, request: SyncRequest): Promise<SyncResult> {
  if (isOriginalTemplateId(request.destination.id)) throw new ApiError(400, { code: "destination", message: "The public starter template cannot receive bookmarks. Connect the database inside your own duplicate." });
  const url = normalizeUrl(request.bookmark.url);
  if (!url) throw new ApiError(400, { code: "item", message: "Only HTTP and HTTPS website bookmarks can be saved." });
  const resourceKey = hash(`${request.destination.id}\n${url}`);
  const lock = `${connection.id}:${resourceKey}`;
  if (locks.has(lock)) throw new ApiError(409, { code: "busy", message: "This bookmark is already being processed.", retryAfter: 5 });
  locks.add(lock);
  try {
    const previous = db.prepare("SELECT state, page_id, page_url FROM bns_operations WHERE owner = ? AND operation_id = ?").get(connection.id, request.operationId) as Operation | undefined;
    if (previous?.page_id && previous.page_url && ["saved", "duplicate"].includes(previous.state)) return { status: previous.state as "saved" | "duplicate", pageId: previous.page_id, pageUrl: previous.page_url };
    await validateMapping(connection, request.destination);
    const existing = await findPages(connection, request.destination, [url]);
    const remember = (status: "saved" | "duplicate", pageId: string, pageUrl: string): SyncResult => {
      db.prepare("INSERT INTO bns_operations(owner, operation_id, resource_key, state, page_id, page_url, updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner, operation_id) DO UPDATE SET state=excluded.state, page_id=excluded.page_id, page_url=excluded.page_url, updated_at=excluded.updated_at").run(connection.id, request.operationId, resourceKey, status, pageId, pageUrl, Date.now());
      return { status, pageId, pageUrl, ...(existing.length > 1 ? { multipleMatches: true } : {}) };
    };
    if (existing.length) return remember("duplicate", existing[0].id, existing[0].url);
    const uncertain = db.prepare("SELECT state FROM bns_operations WHERE owner = ? AND resource_key = ? AND state IN ('writing', 'uncertain') LIMIT 1").get(connection.id, resourceKey);
    if (uncertain) throw new ApiError(409, { code: "uncertain", message: "The previous save may have reached Notion. We are checking before creating another entry. If it stays unresolved, inspect the destination in Notion; this item is retained." });
    db.prepare("INSERT INTO bns_operations(owner, operation_id, resource_key, state, updated_at) VALUES(?,?,?,'writing',?) ON CONFLICT(owner, operation_id) DO UPDATE SET state='writing', updated_at=excluded.updated_at").run(connection.id, request.operationId, resourceKey, Date.now());
    try {
      const page = await createPage(connection, request.destination, { ...request.bookmark, url });
      return remember("saved", page.id, page.url);
    } catch (error) {
      const definiteRejection = error instanceof ApiError && ["item", "schema", "destination", "auth", "rate_limit"].includes(error.failure.code);
      db.prepare("UPDATE bns_operations SET state = ?, updated_at = ? WHERE owner = ? AND operation_id = ?").run(definiteRejection ? "rejected" : "uncertain", Date.now(), connection.id, request.operationId);
      throw error;
    }
  } finally { locks.delete(lock); }
}
