import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import type { Repository } from "../../supabase/functions/_shared/repository";

/** Execute the real migration and RPC in PostgreSQL, without a cloud account or Docker. */
export async function testPostgres() {
  const database = new PGlite();
  await database.exec("create role anon; create role authenticated; create role service_role;");
  await database.exec(readFileSync(new URL("../../supabase/migrations/202611180001_bookmark_service.sql",import.meta.url),"utf8"));
  await database.exec(readFileSync(new URL("../../supabase/migrations/202611180002_usage_rate_limit.sql",import.meta.url),"utf8"));
  const repository: Repository = { async call(action,payload) {
    const result = await database.query<{ result: unknown }>(`select public.${action === "analytics_allow" ? "bns_analytics_allow" : "bns_service"}($1,$2::jsonb) as result`,[action,JSON.stringify(payload)]);
    return result.rows[0].result;
  } };
  return { database,repository };
}
