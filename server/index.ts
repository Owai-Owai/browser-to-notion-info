import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { configuredDestinationSchema, syncRequestSchema } from "../shared/schema";
import { config, hosted, oauthConfigured, publicOrigin } from "./config";
import { cleanup, db, getConnection, hash, type StoredConnection } from "./database";
import { saveOAuthConnection } from "./connections";
import { allowAuthAttempt } from "./rate-limit";
import { publicPage } from "./public-pages";
import { ApiError, exchangeOAuth, findPages, resolveDestinations } from "./notion";
import { syncBookmark } from "./sync";

const allowedOrigin = `chrome-extension://${config.ALLOWED_EXTENSION_ID}`;
const extensionRedirect = `https://${config.ALLOWED_EXTENSION_ID}.chromiumapp.org/notion`;

async function readBody(request: IncomingMessage): Promise<unknown> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const bytes = Buffer.from(chunk as Uint8Array); size += bytes.length;
    if (size > 256_000) throw new ApiError(413, { code: "validation", message: "This request is too large." });
    chunks.push(bytes);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, { code: "validation", message: "Send a valid JSON request." }); }
}
function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  response.end(JSON.stringify(data));
}
function authenticate(request: IncomingMessage): StoredConnection {
  const value = request.headers.authorization?.replace(/^Bearer /, "");
  const connection = value ? getConnection(value) : undefined;
  if (!connection) throw new ApiError(401, { code: "auth", message: "Reconnect Notion to continue." });
  db.prepare("UPDATE bns_connections SET last_seen = ? WHERE id = ?").run(Date.now(), connection.id);
  return connection;
}

async function callback(url: URL, response: ServerResponse) {
  const state = url.searchParams.get("state");
  const flow = state ? db.prepare("SELECT challenge, expires, existing_connection_id FROM bns_flows WHERE state = ? AND connection_id IS NULL").get(state) as { challenge: string; expires: number; existing_connection_id: string | null } | undefined : undefined;
  if (!flow || flow.expires < Date.now()) throw new ApiError(400, { code: "auth", message: "This connection attempt expired. Return to the extension and reconnect." });
  const redirect = new URL(extensionRedirect);
  if (url.searchParams.has("error") || !url.searchParams.get("code")) {
    db.prepare("DELETE FROM bns_flows WHERE state = ?").run(state!);
    redirect.searchParams.set("error", "denied");
  } else {
    // Claim the callback before awaiting Notion; a replay cannot exchange it twice.
    db.prepare("UPDATE bns_flows SET connection_id = 'exchanging' WHERE state = ?").run(state!);
    const tokens = await exchangeOAuth({ grant_type: "authorization_code", code: url.searchParams.get("code"), redirect_uri: config.NOTION_REDIRECT_URI });
    const id = saveOAuthConnection(tokens, flow.existing_connection_id);
    const ticket = randomBytes(32).toString("base64url");
    db.prepare("UPDATE bns_flows SET ticket_hash = ?, connection_id = ?, expires = ? WHERE state = ?").run(hash(ticket), id, Date.now() + 5 * 60_000, state!);
    redirect.searchParams.set("ticket", ticket);
  }
  response.writeHead(302, { Location: redirect.toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); response.end();
}

export const server = createServer(async (request, response) => {
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (hosted) response.setHeader("Strict-Transport-Security", "max-age=31536000");
  try {
    const validHost = hosted ? request.headers.host === new URL(publicOrigin).host : request.headers.host === `127.0.0.1:${config.PORT}` || request.headers.host === `localhost:${config.PORT}`;
    if (!validHost) throw new ApiError(403, { code: "origin", message: "This service only accepts requests for its configured address." });
    const url = new URL(request.url || "/", publicOrigin);
    if (request.method === "GET" && url.pathname === "/healthz") {
      db.prepare("SELECT 1").get();
      json(response, oauthConfigured ? 200 : 503, { ok: oauthConfigured, mode: config.SERVICE_MODE, extensionId: config.ALLOWED_EXTENSION_ID }); return;
    }
    if (request.method === "GET" && ["/", "/privacy"].includes(url.pathname)) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" });
      response.end(publicPage(url.pathname === "/privacy")); return;
    }
    if (request.method === "GET" && url.pathname === "/oauth/callback") { await callback(url, response); return; }
    if (request.headers.origin !== allowedOrigin) throw new ApiError(403, { code: "origin", message: "Use the configured Chrome extension to access this service." });
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    response.setHeader("Vary", "Origin");
    if (request.method === "OPTIONS") {
      response.writeHead(204, { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" }); response.end(); return;
    }
    if (request.method !== "POST") { json(response, 405, { code: "method", message: "Method not allowed." }); return; }
    cleanup();
    const body = await readBody(request);
    if (url.pathname === "/v1/auth/start") {
      if (!oauthConfigured) throw new ApiError(503, { code: "configuration", message: "The Notion connection is temporarily unavailable. Please try again later." });
      if (!allowAuthAttempt(request)) throw new ApiError(429, { code: "rate_limit", message: "Too many connection attempts. Wait a few minutes.", retryAfter: 600 });
      const { challenge } = z.object({ challenge: z.string().regex(/^[a-zA-Z0-9_-]{43}$/) }).parse(body);
      const count = db.prepare("SELECT COUNT(*) AS count FROM bns_flows").get() as { count: number };
      if (count.count >= 2000) throw new ApiError(429, { code: "rate_limit", message: "The connection service is busy. Please try again shortly.", retryAfter: 60 });
      const state = randomBytes(32).toString("base64url");
      const currentSession = request.headers.authorization?.replace(/^Bearer /, "");
      const existing = currentSession ? getConnection(currentSession) : undefined;
      db.prepare("INSERT INTO bns_flows(state, challenge, expires, existing_connection_id) VALUES(?,?,?,?)").run(state, challenge, Date.now() + 10 * 60_000, existing?.id ?? null);
      const authorize = new URL("https://api.notion.com/v1/oauth/authorize");
      authorize.search = new URLSearchParams({ client_id: config.NOTION_CLIENT_ID, response_type: "code", owner: "user", redirect_uri: config.NOTION_REDIRECT_URI, state }).toString();
      json(response, 200, { url: authorize.toString() }); return;
    }
    if (url.pathname === "/v1/auth/exchange") {
      const { ticket, verifier } = z.object({ ticket: z.string().min(40).max(100), verifier: z.string().min(40).max(100) }).parse(body);
      const flow = db.prepare("SELECT state, challenge, connection_id, expires FROM bns_flows WHERE ticket_hash = ?").get(hash(ticket)) as { state: string; challenge: string; connection_id: string; expires: number } | undefined;
      if (!flow || flow.expires < Date.now() || createHash("sha256").update(verifier).digest("base64url") !== flow.challenge) throw new ApiError(401, { code: "auth", message: "This connection attempt expired. Reconnect Notion." });
      const token = randomBytes(32).toString("base64url");
      db.prepare("UPDATE bns_connections SET session_hash = ?, last_seen = ? WHERE id = ?").run(hash(token), Date.now(), flow.connection_id);
      db.prepare("DELETE FROM bns_flows WHERE state = ?").run(flow.state);
      const connection = getConnection(token)!;
      json(response, 200, { token, workspaceId: connection.workspace_id, workspaceName: connection.workspace_name }); return;
    }
    const connection = authenticate(request);
    if (url.pathname === "/v1/destinations") {
      const { link } = z.object({ link: z.string().max(4000) }).parse(body);
      json(response, 200, await resolveDestinations(connection, link)); return;
    }
    if (url.pathname === "/v1/preview") {
      const input = z.object({ urls: z.array(z.string().url().max(2000)).min(1).max(50), destination: configuredDestinationSchema }).parse(body);
      const pages = await findPages(connection, input.destination, input.urls);
      const urls = pages.flatMap(page => Object.values(page.properties).flatMap(property => property.type === "url" && property.url ? [property.url] : []));
      json(response, 200, { existing: [...new Set(urls.filter(url => input.urls.includes(url)))] }); return;
    }
    if (url.pathname === "/v1/sync") { json(response, 200, await syncBookmark(connection, syncRequestSchema.parse(body))); return; }
    if (url.pathname === "/v1/disconnect") {
      db.prepare("DELETE FROM bns_operations WHERE owner = ?").run(connection.id);
      db.prepare("DELETE FROM bns_flows WHERE connection_id = ? OR existing_connection_id = ?").run(connection.id, connection.id);
      db.prepare("DELETE FROM bns_connections WHERE id = ?").run(connection.id);
      json(response, 200, { ok: true }); return;
    }
    json(response, 404, { code: "not_found", message: "This endpoint does not exist." });
  } catch (error) {
    if (error instanceof ApiError) json(response, error.status, error.failure);
    else if (error instanceof z.ZodError) json(response, 400, { code: "validation", message: "The request or Notion response has an unexpected format. Check the current setup and try again." });
    else { console.error("Connection service request failed:", error instanceof Error ? error.name : "Unknown error"); json(response, 500, { code: "service", message: "The connection service encountered an error. Your pending work is retained." }); }
  }
});

cleanup();
setInterval(cleanup, 60 * 60_000).unref();
server.listen(config.PORT, hosted ? "0.0.0.0" : "127.0.0.1", () => {
  console.info(`Browser to Notion service: ${publicOrigin}`);
  console.info(oauthConfigured ? "Notion OAuth configured." : "Add your Notion OAuth credentials to .env.local using docs/LOCAL-SETUP.md.");
});
