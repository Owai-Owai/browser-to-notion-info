import { z } from "zod";
import { db, decrypt, encrypt, type StoredConnection } from "./database";
import { config } from "./config";

import { ApiError } from '../shared/api-error';
import { notionOperations, recordSchema } from '../shared/notion-operations';
export { ApiError } from '../shared/api-error';
export { notionId, recordSchema } from '../shared/notion-operations';

const tokenSchema = z.object({ access_token: z.string(), refresh_token: z.string().optional() });
const oauthSchema = tokenSchema.extend({ workspace_id: z.string(), workspace_name: z.string().nullable().optional() });


export async function exchangeOAuth(body: object) {
  const response = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${config.NOTION_CLIENT_ID}:${config.NOTION_CLIENT_SECRET}`).toString("base64")}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new ApiError(401, { code: "auth", message: "Notion authorization did not finish. Check the integration configuration and reconnect." });
  return oauthSchema.parse(await response.json());
}

const nextRequest = new Map<string, number>();
/** A conservative per-connection pace; server responses remain authoritative. */
export async function notion(connection: StoredConnection, path: string, body?: unknown, method?: string, refresh = true): Promise<unknown> {
  const tokens = tokenSchema.parse(decrypt(connection.encrypted_tokens));
  const due = Math.max(Date.now(), nextRequest.get(connection.id) ?? 0);
  nextRequest.set(connection.id, due + 400);
  if (due > Date.now()) await new Promise(resolve => setTimeout(resolve, due - Date.now()));
  let response: Response;
  try {
    response = await fetch(`https://api.notion.com/v1${path}`, {
      method: method ?? (body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Notion-Version": "2025-09-03", "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000),
    });
  } catch { throw new ApiError(503, { code: "temporary", message: "Notion could not be reached. Your bookmark is waiting to retry." }); }
  if (response.status === 401 && refresh && tokens.refresh_token) {
    try {
      const response = await fetch("https://api.notion.com/v1/oauth/token", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(`${config.NOTION_CLIENT_ID}:${config.NOTION_CLIENT_SECRET}`).toString("base64")}` },
        body: JSON.stringify({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error("Refresh failed");
      const refreshed = tokenSchema.parse(await response.json());
      connection.encrypted_tokens = encrypt(refreshed);
      db.prepare("UPDATE bns_connections SET encrypted_tokens = ? WHERE id = ?").run(connection.encrypted_tokens, connection.id);
      return notion(connection, path, body, method, false);
    } catch { throw new ApiError(401, { code: "auth", message: "Reconnect Notion to continue saving bookmarks." }); }
  }
  if (!response.ok) {
    if (response.status === 429 || response.status === 529) throw new ApiError(429, { code: "rate_limit", message: "Notion is busy. Saving will resume automatically.", retryAfter: Math.max(1, Number(response.headers.get("Retry-After")) || 30) });
    if (response.status === 401) throw new ApiError(401, { code: "auth", message: "Reconnect Notion to continue saving bookmarks." });
    if ([403, 404].includes(response.status)) throw new ApiError(400, { code: "destination", message: "Notion cannot access this destination. Grant the integration access or choose another database." });
    if (response.status >= 500) throw new ApiError(503, { code: "temporary", message: "Notion is temporarily unavailable. Saving will retry." });
    const error = recordSchema.safeParse(await response.json().catch(() => null));
    const isLimit = error.success && ["restricted_resource", "row_limit_exceeded"].includes(String(error.data.code));
    throw new ApiError(400, { code: isLimit ? "destination" : "schema", message: isLimit ? "This Notion workspace has a content limit. Check its plan and available capacity." : "Notion rejected the entry. Recheck the property mappings and field lengths." });
  }
  return response.json();
}


export const { resolveDestinations, validateMapping, findPages, createPage } = notionOperations<StoredConnection>(notion);
