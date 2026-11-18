import { createHandler } from "../_shared/handler.ts";
import { edgeConfig } from "../_shared/config.ts";
import { postgresRepository } from "../_shared/repository.ts";

const names = ["SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_SECRET_KEYS","SERVICE_PUBLIC_URL","PRIVACY_URL","NOTION_CLIENT_ID","NOTION_CLIENT_SECRET","TOKEN_ENCRYPTION_KEY","ALLOWED_EXTENSION_ID","PUBLISHER_NAME","SUPPORT_EMAIL"];
try {
  const config = edgeConfig(Object.fromEntries(names.map(name => [name,Deno.env.get(name)])));
  Deno.serve(createHandler(config,postgresRepository(config.projectUrl,config.serviceKey)));
} catch {
  // Never log environment values or credentials when configuration is incomplete.
  Deno.serve(() => Response.json({ code: "configuration",message: "The connection service is not configured yet." },{ status: 503 }));
}
