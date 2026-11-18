import { z } from "zod";
import { ApiError } from "../../../shared/api-error.ts";
import { configuredDestinationSchema,syncRequestSchema } from "../../../shared/schema.ts";
import { challenge,hash,randomToken } from "./crypto.ts";
import { connectionSchema,okSchema,rpc,type Repository } from "./repository.ts";
import { notionClient } from "./notion.ts";
import { syncBookmark } from "./sync.ts";
import type { EdgeConfig } from "./config.ts";
import { captureUsage } from "./analytics.ts";

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length"))>256_000) throw new ApiError(413,{ code: "validation",message: "This request is too large." });
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  if (reader) {
    while (true) {
      const { done,value } = await reader.read(); if (done) break;
      size += value.length;
      if (size>256_000) { await reader.cancel(); throw new ApiError(413,{ code: "validation",message: "This request is too large." }); }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size); let position = 0;
  for (const chunk of chunks) { bytes.set(chunk,position); position+=chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ApiError(400,{ code: "validation",message: "Send a valid JSON request." }); }
}

export function createHandler(config: EdgeConfig,repository: Repository,transport: typeof fetch = fetch) {
  const notion = notionClient(config,repository,transport);
  const origin = `chrome-extension://${config.extensionId}`;
  const basePath = new URL(config.serviceUrl).pathname;
  const gatewayPath = `/${basePath.split("/").at(-1)}`;
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({ "Cache-Control": "no-store","Referrer-Policy": "no-referrer","X-Content-Type-Options": "nosniff" });
    const json = (status: number,data: unknown) => Response.json(data,{ status,headers });
    const redirect = (url: string) => new Response(null,{ status: 302,headers: new Headers({ ...Object.fromEntries(headers),Location: url }) });
    try {
      const url = new URL(request.url);
      const prefix = url.pathname === basePath || url.pathname.startsWith(`${basePath}/`) ? basePath : url.pathname === gatewayPath || url.pathname.startsWith(`${gatewayPath}/`) ? gatewayPath : undefined;
      if (!prefix) return json(404,{ code: "not_found",message: "This endpoint does not exist." });
      const path = url.pathname.slice(prefix.length) || "/";
      if (request.method === "GET" && path === "/healthz") {
        await rpc(repository,"health",{},okSchema);
        return json(200,{ ok: true,mode: "hosted",provider: "supabase",extensionId: config.extensionId,privacyUrl: config.privacyUrl });
      }
      if (request.method === "GET" && path === "/privacy") return redirect(config.privacyUrl);
      if (request.method === "GET" && path === "/") return json(200,{ name: "Browser to Notion",privacyUrl: config.privacyUrl });
      if (request.method === "GET" && path === "/oauth/callback") {
        const state = z.string().min(40).max(100).parse(url.searchParams.get("state"));
        const denied = url.searchParams.has("error") || !url.searchParams.get("code");
        const stateHash = await hash(state);
        await rpc(repository,"claim_flow",{ state_hash: stateHash,denied },okSchema);
        const destination = new URL(`https://${config.extensionId}.chromiumapp.org/notion`);
        if (denied) destination.searchParams.set("error","denied");
        else {
          const tokens = await notion.exchangeOAuth({ grant_type: "authorization_code",code: url.searchParams.get("code"),redirect_uri: `${config.serviceUrl}/oauth/callback` });
          const ticket = randomToken();
          await rpc(repository,"complete_flow",{ state_hash: stateHash,workspace_id: tokens.workspace_id,workspace_name: tokens.workspace_name || "Notion workspace",encrypted_tokens: await notion.encryption.encrypt(tokens),ticket_hash: await hash(ticket) },okSchema);
          destination.searchParams.set("ticket",ticket);
        }
        return redirect(destination.href);
      }
      if (request.headers.get("origin") !== origin) throw new ApiError(403,{ code: "origin",message: "Use Browser to Notion to access this service." });
      headers.set("Access-Control-Allow-Origin",origin); headers.set("Vary","Origin");
      if (request.method === "OPTIONS") {
        headers.set("Access-Control-Allow-Methods","POST, OPTIONS"); headers.set("Access-Control-Allow-Headers","Authorization, Content-Type");
        return new Response(null,{ status: 204,headers });
      }
      if (request.method !== "POST") return json(405,{ code: "method",message: "Method not allowed." });
      const body = await readBody(request);
      const session = request.headers.get("authorization")?.replace(/^Bearer /,"");
      if (path === "/v1/auth/start") {
        const input = z.object({ challenge: z.string().regex(/^[a-z\d_-]{43}$/i) }).parse(body);
        const state = randomToken();
        // Address headers only rate-limit abuse; they never authenticate a user.
        const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
        await rpc(repository,"start_flow",{ state_hash: await hash(state),challenge: input.challenge,client_hash: await hash(address),session_hash: session ? await hash(session) : null },okSchema);
        const authorize = new URL("https://api.notion.com/v1/oauth/authorize");
        authorize.search = new URLSearchParams({ client_id: config.notionClientId,response_type: "code",owner: "user",redirect_uri: `${config.serviceUrl}/oauth/callback`,state }).toString();
        return json(200,{ url: authorize.href });
      }
      if (path === "/v1/auth/exchange") {
        const input = z.object({ ticket: z.string().min(40).max(100),verifier: z.string().min(40).max(100) }).parse(body);
        const token = randomToken();
        const workspace = await rpc(repository,"exchange_ticket",{ ticket_hash: await hash(input.ticket),challenge: await challenge(input.verifier),session_hash: await hash(token) },z.object({ workspace_id: z.string(),workspace_name: z.string() }));
        return json(200,{ token,workspaceId: workspace.workspace_id,workspaceName: workspace.workspace_name });
      }
      if (!session) throw new ApiError(401,{ code: "auth",message: "Reconnect Notion to continue." });
      const connection = await rpc(repository,"authenticate",{ session_hash: await hash(session) },connectionSchema);
      if (path === "/v1/analytics") return json(200, await captureUsage(config, repository, connection.id, body, transport));
      if (path === "/v1/destinations") {
        const input = z.object({ link: z.string().max(4000) }).parse(body);
        return json(200,await notion.resolveDestinations(connection,input.link));
      }
      if (path === "/v1/preview") {
        const input = z.object({ urls: z.array(z.string().url().max(2000)).min(1).max(50),destination: configuredDestinationSchema }).parse(body);
        const pages = await notion.findPages(connection,input.destination,input.urls);
        const urls = pages.flatMap(page => Object.values(page.properties).flatMap(property => property.type === "url" && property.url ? [property.url] : []));
        return json(200,{ existing: [...new Set(urls.filter(value => input.urls.includes(value)))] });
      }
      if (path === "/v1/sync") return json(200,await syncBookmark(repository,notion,connection,syncRequestSchema.parse(body)));
      if (path === "/v1/disconnect") { await rpc(repository,"disconnect",{ owner: connection.id },okSchema); return json(200,{ ok: true }); }
      return json(404,{ code: "not_found",message: "This endpoint does not exist." });
    } catch (error) {
      if (error instanceof ApiError) return json(error.status,error.failure);
      if (error instanceof z.ZodError) return json(400,{ code: "validation",message: "The request or destination has an unexpected format. Review your setup and try again." });
      console.error("Bookmark service request failed:",error instanceof Error ? error.name : "Unknown error");
      return json(503,{ code: "service",message: "The connection service is unavailable. Your pending work is retained." });
    }
  };
}
