import { afterAll,beforeAll,beforeEach,describe,expect,it } from "vitest";
import { createCipheriv,randomBytes } from "node:crypto";
import { testPostgres } from "../helpers/postgres";
import { createHandler } from "../../supabase/functions/_shared/handler";
import { edgeConfig } from "../../supabase/functions/_shared/config";
import { challenge,hash,tokenEncryption } from "../../supabase/functions/_shared/crypto";
import { rpc,connectionSchema,postgresRepository } from "../../supabase/functions/_shared/repository";
import { notionTemplate } from "../../shared/notion-template";
import type { ConfiguredDestination,SyncRequest } from "../../shared/schema";

const config = edgeConfig({ SUPABASE_URL: "https://migration.supabase.co",SUPABASE_SERVICE_ROLE_KEY: "server-only-database-key",SERVICE_PUBLIC_URL: "https://migration.supabase.co/functions/v1/notion-sync",PRIVACY_URL: "https://privacy.example.test/privacy.html",NOTION_CLIENT_ID: "test-client",NOTION_CLIENT_SECRET: "test-client-secret",TOKEN_ENCRYPTION_KEY: "a".repeat(64),ALLOWED_EXTENSION_ID: "a".repeat(32),PUBLISHER_NAME: "Test publisher",SUPPORT_EMAIL: "support@example.test" });
const destination: ConfiguredDestination = { id: "source",name: "Bookmarks",url: "https://www.notion.so/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",mapping: { titleId: "title",urlId: "url" },properties: [{ id: "title",name: "Name",type: "title",options: [] },{ id: "url",name: "URL",type: "url",options: [] }] };
type Page = { id: string;url: string;properties: { URL: { type: string;url: string } } };
let fixture: Awaited<ReturnType<typeof testPostgres>>;
let handler: ReturnType<typeof createHandler>;
let pages: Page[];
let creates: number;
let refreshes: number;
let loseResponse: boolean;
let queryVisible: boolean;
let requireRefresh: boolean;
let holdCreate: (() => Promise<void>) | undefined;
const transport: typeof fetch = async (input,init) => {
  const url = String(input);
  if (url.endsWith("/oauth/token")) {
    const body = JSON.parse(String(init?.body));
    if (body.grant_type === "refresh_token") refreshes++;
    return Response.json({ access_token: body.grant_type === "refresh_token" ? "renewed-access" : "notion-access",refresh_token: "notion-refresh",workspace_id: body.code === "another-workspace" ? "workspace-b" : "workspace",workspace_name: "Test workspace" });
  }
  if (requireRefresh && new Headers(init?.headers).get("authorization") === "Bearer notion-access") return Response.json({}, { status: 401 });
  if (url.includes("/databases/")) return Response.json({ data_sources: [{ id: "source" }] });
  if (url.endsWith("/data_sources/source")) return Response.json({ id: "source",properties: { Name: { id: "title",name: "Name",type: "title" },URL: { id: "url",name: "URL",type: "url" } } });
  if (url.endsWith("/query")) return Response.json({ results: queryVisible ? pages : [],has_more: false,next_cursor: null });
  if (url.endsWith("/pages")) {
    creates++; if (holdCreate) await holdCreate();
    const page = { id: "page",url: "https://www.notion.so/page",properties: { URL: { type: "url",url: "https://example.com/article" } } };
    pages.push(page);
    if (loseResponse) throw new TypeError("The upstream response was lost");
    return Response.json(page);
  }
  throw new Error("Unexpected upstream request");
};
beforeAll(async () => { fixture = await testPostgres(); },30_000);
beforeEach(async () => {
  await fixture.database.exec("truncate bns_private.connections,bns_private.auth_limits cascade");
  pages=[]; creates=0; refreshes=0; loseResponse=false; queryVisible=true; requireRefresh=false; holdCreate=undefined;
  handler=createHandler(config,fixture.repository,transport);
});
afterAll(async () => { await fixture?.database.close(); });
const post = (path: string,body: unknown,token?: string,run=handler) => run(new Request(`${config.serviceUrl}${path}`, { method: "POST",headers: { Origin: `chrome-extension://${config.extensionId}`,"Content-Type": "application/json","X-Forwarded-For": "192.0.2.1",...(token ? { Authorization: `Bearer ${token}` } : {}) },body: JSON.stringify(body) }));
async function flow(existing?: string,code="test-code") {
  const verifier="v".repeat(43);
  const start=await post("/v1/auth/start",{ challenge: await challenge(verifier) },existing);
  expect(start.status).toBe(200);
  const authorize = new URL((await start.json()).url);
  const state=authorize.searchParams.get("state")!;
  const callback=await handler(new Request(`${config.serviceUrl}/oauth/callback?state=${state}&code=${code}`));
  expect(callback.status).toBe(302);
  return { ticket: new URL(callback.headers.get("location")!).searchParams.get("ticket")!,verifier,state };
}
async function connect(existing?: string,code?: string) {
  const response=await post("/v1/auth/exchange",await flow(existing,code));
  expect(response.status).toBe(200);
  return (await response.json()).token as string;
}
const request = (): SyncRequest => ({ operationId: crypto.randomUUID(),bookmark: { id: "bookmark",title: "Resource",url: "https://example.com/article",folderPath: "Reading",dateAdded: 123 },destination });

describe("Supabase migration and service",() => {
  it("uses the injected modern secret key on apikey without treating it as a JWT",async () => {
    const modern=edgeConfig({ SUPABASE_URL: config.projectUrl,SUPABASE_SECRET_KEYS: JSON.stringify({ default: "sb_secret_test_server_only" }),SERVICE_PUBLIC_URL: config.serviceUrl,PRIVACY_URL: config.privacyUrl,NOTION_CLIENT_ID: config.notionClientId,NOTION_CLIENT_SECRET: config.notionClientSecret,TOKEN_ENCRYPTION_KEY: config.encryptionKey,ALLOWED_EXTENSION_ID: config.extensionId,PUBLISHER_NAME: config.publisherName,SUPPORT_EMAIL: config.supportEmail });
    const adapter=postgresRepository(modern.projectUrl,modern.serviceKey,async (_input,init) => {
      const headers=new Headers(init?.headers);
      expect(headers.get("apikey")).toBe("sb_secret_test_server_only");
      expect(headers.has("authorization")).toBe(false);
      return Response.json({ ok: true });
    });
    expect(await adapter.call("health",{})).toEqual({ ok: true });
  });
  it("keeps database tables and RPC unavailable to anonymous and signed-in client roles",async () => {
    for (const role of ["anon","authenticated"]) {
      await fixture.database.exec(`set role ${role}`);
      try {
        await expect(fixture.database.query("select * from bns_private.connections")).rejects.toThrow(/permission denied/);
        await expect(fixture.repository.call("health",{})).rejects.toThrow(/permission denied/);
      } finally { await fixture.database.exec("reset role"); }
    }
    await fixture.database.exec("set role service_role");
    try { expect(await fixture.repository.call("health",{})).toEqual({ ok: true }); }
    finally { await fixture.database.exec("reset role"); }
  });
  it("serves health at both gateway path formats and redirects to the separate public policy",async () => {
    const health=await handler(new Request(`${config.serviceUrl}/healthz`));
    expect(await health.json()).toMatchObject({ ok: true,provider: "supabase",privacyUrl: config.privacyUrl });
    expect((await handler(new Request("https://internal.example/notion-sync/healthz"))).status).toBe(200);
    expect((await handler(new Request(`${config.serviceUrl}/privacy`))).headers.get("location")).toBe(config.privacyUrl);
  });
  it("rejects a foreign origin and unauthenticated private requests",async () => {
    expect((await handler(new Request(`${config.serviceUrl}/v1/auth/start`,{ method: "POST",headers: { Origin: "https://attacker.example" },body: "{}" }))).status).toBe(403);
    expect((await post("/v1/destinations",{ link: destination.url })).status).toBe(401);
  });
  it("uses a callback below the function prefix, checks PKCE, and consumes tickets and states once",async () => {
    const pending=await flow();
    expect((await post("/v1/auth/exchange",{ ...pending,verifier: "wrong".repeat(10) })).status).toBe(401);
    const exchanged=await post("/v1/auth/exchange",pending);
    expect(exchanged.status).toBe(200);
    expect((await post("/v1/auth/exchange",pending)).status).toBe(401);
    expect((await handler(new Request(`${config.serviceUrl}/oauth/callback?state=${pending.state}&code=test-code`))).status).toBe(401);
    const text=JSON.stringify(await fixture.database.query("select * from bns_private.connections"));
    expect(text).not.toContain("notion-access"); expect(text).not.toContain("test-client-secret");
  });
  it("isolates users in the same workspace and keeps another installation valid after disconnect",async () => {
    const first=await connect(), second=await connect();
    const firstConnection=await rpc(fixture.repository,"authenticate",{ session_hash: await hash(first) },connectionSchema);
    const secondConnection=await rpc(fixture.repository,"authenticate",{ session_hash: await hash(second) },connectionSchema);
    expect(firstConnection.id).not.toBe(secondConnection.id);
    expect((await post("/v1/disconnect",{},first)).status).toBe(200);
    expect((await post("/v1/destinations",{ link: destination.url },first)).status).toBe(401);
    expect((await post("/v1/destinations",{ link: destination.url },second)).status).toBe(200);
  });
  it("saves once, replays the operation, and skips another bookmark with the same URL",async () => {
    const token=await connect(), input=request();
    expect((await (await post("/v1/sync",input,token)).json()).status).toBe("saved");
    expect((await (await post("/v1/sync",input,token)).json()).status).toBe("saved");
    expect((await (await post("/v1/sync",request(),token)).json()).status).toBe("duplicate");
    expect(creates).toBe(1);
  });
  it("retains uncertain writes across a new function instance and reconciles without repeating creation",async () => {
    const token=await connect(),input=request(); loseResponse=true; queryVisible=false;
    expect((await post("/v1/sync",input,token)).status).toBe(503);
    const restarted=createHandler(config,fixture.repository,transport);
    loseResponse=false;
    const checking=await post("/v1/sync",input,token,restarted);
    expect(checking.status).toBe(409); expect((await checking.json()).code).toBe("uncertain");
    queryVisible=true;
    expect((await post("/v1/sync",input,token,restarted)).status).toBe(200);
    expect(creates).toBe(1);
  });
  it("prevents concurrent function instances from creating the same resource",async () => {
    const token=await connect(),otherToken=await connect(),input=request();
    let release!: () => void,entered!: () => void;
    const started=new Promise<void>(resolve => { entered=resolve; });
    const pending=new Promise<void>(resolve => { release=resolve; });
    holdCreate=async () => { entered(); await pending; };
    const first=post("/v1/sync",input,token);
    await started;
    try {
      const other=createHandler(config,fixture.repository,transport);
      const second=await post("/v1/sync",request(),otherToken,other);
      expect(second.status).toBe(409); expect((await second.json()).code).toBe("busy");
    } finally { release(); }
    expect((await first).status).toBe(200); expect(creates).toBe(1);
  });
  it("preserves save recovery on reconnect and rejects a new write before a prior create is query-visible",async () => {
    const token=await connect(); const input=request();
    expect((await post("/v1/sync",input,token)).status).toBe(200);
    const renewed=await connect(token);
    queryVisible=false;
    expect((await post("/v1/sync",input,renewed)).status).toBe(200);
    expect((await post("/v1/sync",request(),renewed)).status).toBe(409);
    expect(creates).toBe(1);
  });
  it("refreshes credentials in PostgreSQL and rejects the public template as a destination",async () => {
    const token=await connect(); requireRefresh=true;
    expect((await post("/v1/destinations",{ link: destination.url },token)).status).toBe(200);
    expect(refreshes).toBe(1);
    const input=request(); input.destination={ ...destination,id: notionTemplate.dataSourceId };
    expect((await post("/v1/sync",input,token)).status).toBe(400); expect(creates).toBe(0);
  });
  it("removes expired credentials with their operations and blocks a callback after disconnect",async () => {
    const token=await connect(); await post("/v1/sync",request(),token);
    const verifier="p".repeat(43);
    const start=await post("/v1/auth/start",{ challenge: await challenge(verifier) },token);
    const state=new URL((await start.json()).url).searchParams.get("state")!;
    await post("/v1/disconnect",{},token);
    expect((await handler(new Request(`${config.serviceUrl}/oauth/callback?state=${state}&code=test-code`))).status).toBe(401);
    await connect();
    await fixture.database.exec("update bns_private.connections set last_seen=now()-interval '91 days'; select public.bns_cleanup();");
    const counts=await fixture.database.query<{ count: number }>("select count(*)::integer as count from bns_private.connections");
    expect(counts.rows[0].count).toBe(0);
  });
  it("can decrypt the local pilot's AES-GCM format without exposing its credentials",async () => {
    const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",Buffer.from(config.encryptionKey,"hex"),iv);
    const data=Buffer.concat([cipher.update(JSON.stringify({ access_token: "portability-test" })),cipher.final()]);
    const encrypted=Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64");
    const crypto=tokenEncryption(config.encryptionKey);
    expect(await crypto.decrypt(encrypted)).toEqual({ access_token: "portability-test" });
    expect(await crypto.decrypt(await crypto.encrypt({ access_token: "new-test" }))).toEqual({ access_token: "new-test" });
  });
});
