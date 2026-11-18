import { ApiError } from "../../../shared/api-error.ts";
import { isOriginalTemplateId } from "../../../shared/notion-template.ts";
import type { SyncRequest, SyncResult } from "../../../shared/schema.ts";
import { normalizeUrl } from "../../../src/lib/bookmarks.ts";
import { hash } from "./crypto.ts";
import { okSchema, operationResultSchema, rpc, type Connection, type Repository } from "./repository.ts";
import type { NotionClient } from "./notion.ts";

/** Persist the write intent before Notion; every isolate uses the same database fence. */
export async function syncBookmark(repository: Repository, notion: NotionClient, connection: Connection, input: SyncRequest): Promise<SyncResult> {
  if (isOriginalTemplateId(input.destination.id)) throw new ApiError(400, { code: "destination",message: "The public starter template cannot receive bookmarks. Connect your own duplicate." });
  const url = normalizeUrl(input.bookmark.url);
  if (!url) throw new ApiError(400, { code: "item",message: "Only HTTP and HTTPS website bookmarks can be saved." });
  const resource = await hash(`${input.destination.id}\n${url}`);
  const payload = { owner: connection.id,operation_id: input.operationId,resource_key: resource,lock_id: crypto.randomUUID() };
  const previous = (await rpc(repository,"operation",payload,operationResultSchema)).operation;
  const result = (operation: NonNullable<typeof previous>): SyncResult | undefined => operation.page_id && operation.page_url && ["saved","duplicate"].includes(operation.state) ? { status: operation.state as "saved" | "duplicate",pageId: operation.page_id,pageUrl: operation.page_url } : undefined;
  const replay = previous && result(previous);
  if (replay) return replay;
  await rpc(repository,"acquire_save",payload,okSchema);
  try {
    await notion.validateMapping(connection,input.destination);
    const existing = await notion.findPages(connection,input.destination,[url]);
    const remember = async (status: "saved" | "duplicate",pageId: string,pageUrl: string,confirmed: boolean): Promise<SyncResult> => {
      await rpc(repository,"finish_save", { ...payload,state: status,page_id: pageId,page_url: pageUrl,confirmed },okSchema);
      return { status,pageId,pageUrl,...(existing.length>1 ? { multipleMatches: true } : {}) };
    };
    if (existing.length) return remember(previous?.state === "uncertain" || previous?.state === "writing" ? "saved" : "duplicate",existing[0].id,existing[0].url,true);
    const begin = (await rpc(repository,"begin_write",payload,operationResultSchema)).operation;
    const completed = begin && result(begin);
    if (completed) return completed;
    try {
      const page = await notion.createPage(connection,input.destination,{ ...input.bookmark,url });
      return await remember("saved",page.id,page.url,false);
    } catch (error) {
      const rejected = error instanceof ApiError && ["item","schema","destination","auth","rate_limit"].includes(error.failure.code);
      await rpc(repository,"fail_write", { ...payload,state: rejected ? "rejected" : "uncertain" },okSchema).catch(() => undefined);
      throw error;
    }
  } finally { await rpc(repository,"release_save",payload,okSchema).catch(() => undefined); }
}
