import { z } from "zod";
import { ApiError } from "../../../shared/api-error.ts";
import { notionOperations, recordSchema } from "../../../shared/notion-operations.ts";
import { basicCredential, tokenEncryption } from "./crypto.ts";
import { connectionSchema, okSchema, rpc, type Connection, type Repository } from "./repository.ts";

export interface NotionConfig { notionClientId: string; notionClientSecret: string; encryptionKey: string }
const tokensSchema = z.object({ access_token: z.string(), refresh_token: z.string().optional() });
const oauthSchema = tokensSchema.extend({ workspace_id: z.string(), workspace_name: z.string().nullable().optional() });

export function notionClient(config: NotionConfig, repository: Repository, transport: typeof fetch = fetch) {
  const encryption = tokenEncryption(config.encryptionKey);
  const authorization = `Basic ${basicCredential(`${config.notionClientId}:${config.notionClientSecret}`)}`;
  async function exchange(body: object) {
    let response: Response;
    try { response = await transport("https://api.notion.com/v1/oauth/token", { method: "POST",headers: { "Content-Type": "application/json",Authorization: authorization },body: JSON.stringify(body),signal: AbortSignal.timeout(15_000) }); }
    catch { throw new ApiError(503, { code: "temporary",message: "Notion could not be reached. Try connecting again." }); }
    if (!response.ok) throw new ApiError(401, { code: "auth",message: "Notion authorization did not finish. Reconnect to continue." });
    return response.json();
  }
  async function request(connection: Connection,path: string,body?: unknown,method?: string,refresh = true): Promise<unknown> {
    const tokens = tokensSchema.parse(await encryption.decrypt(connection.encrypted_tokens));
    const slot = await rpc(repository,"reserve_notion",{ owner: connection.id },z.object({ delay: z.number().int().min(0).max(4000) }));
    if (slot.delay) await new Promise(resolve => setTimeout(resolve,slot.delay));
    let response: Response;
    try { response = await transport(`https://api.notion.com/v1${path}`, { method: method ?? (body ? "POST" : "GET"),headers: { Authorization: `Bearer ${tokens.access_token}`,"Notion-Version": "2025-09-03","Content-Type": "application/json" },...(body ? { body: JSON.stringify(body) } : {}),signal: AbortSignal.timeout(15_000) }); }
    catch { throw new ApiError(503, { code: "temporary",message: "Notion could not be reached. Your bookmark is waiting to retry." }); }
    if (response.status === 401 && refresh && tokens.refresh_token) {
      const lock = crypto.randomUUID();
      const claim = await rpc(repository,"claim_refresh", { owner: connection.id,lock_id: lock,token_version: connection.token_version },z.object({ claimed: z.boolean(),connection: connectionSchema }));
      if (claim.claimed) {
        try {
          const refreshed = tokensSchema.parse(await exchange({ grant_type: "refresh_token",refresh_token: tokens.refresh_token }));
          const updated = await rpc(repository,"complete_refresh", { owner: connection.id,lock_id: lock,encrypted_tokens: await encryption.encrypt({ ...tokens,...refreshed }) },connectionSchema);
          Object.assign(connection,updated);
        } finally { await rpc(repository,"release_refresh", { owner: connection.id,lock_id: lock },okSchema).catch(() => undefined); }
      } else Object.assign(connection,claim.connection);
      return request(connection,path,body,method,false);
    }
    if (!response.ok) {
      if ([429,529].includes(response.status)) throw new ApiError(429, { code: "rate_limit",message: "Notion is busy. Saving will resume automatically.",retryAfter: Math.max(1,Number(response.headers.get("Retry-After")) || 30) });
      if (response.status === 401) throw new ApiError(401, { code: "auth",message: "Reconnect Notion to continue saving bookmarks." });
      if ([403,404].includes(response.status)) throw new ApiError(400, { code: "destination",message: "Notion cannot access this destination. Reconnect and grant access to the database." });
      if (response.status >= 500) throw new ApiError(503, { code: "temporary",message: "Notion is temporarily unavailable. Saving will retry." });
      const details = recordSchema.safeParse(await response.json().catch(() => null));
      const capacity = details.success && ["restricted_resource","row_limit_exceeded"].includes(String(details.data.code));
      throw new ApiError(400, { code: capacity ? "destination" : "schema",message: capacity ? "This Notion workspace has a content limit. Check its plan and capacity." : "Notion rejected the entry. Recheck the property mappings and field lengths." });
    }
    return response.json();
  }
  return { ...notionOperations<Connection>(request),async exchangeOAuth(body: object) { return oauthSchema.parse(await exchange(body)); },encryption };
}
export type NotionClient = ReturnType<typeof notionClient>;
