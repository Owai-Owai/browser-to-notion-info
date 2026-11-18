import { z } from "zod";
import { serviceBaseUrl } from "../../../shared/service-url.ts";

const schema = z.object({
  SUPABASE_URL: z.string().url(),SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),SUPABASE_SECRET_KEYS: z.string().optional(),
  SERVICE_PUBLIC_URL: z.string().url(),PRIVACY_URL: z.string().url(),
  NOTION_CLIENT_ID: z.string().min(1),NOTION_CLIENT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i),ALLOWED_EXTENSION_ID: z.string().regex(/^[a-p]{32}$/),
  SUPPORT_EMAIL: z.string().email(),PUBLISHER_NAME: z.string().min(1),
  POSTHOG_PROJECT_TOKEN: z.preprocess(value => value === "" ? undefined : value, z.string().min(20).optional()),
  POSTHOG_HOST: z.enum(["https://us.i.posthog.com", "https://eu.i.posthog.com"]).default("https://us.i.posthog.com"),
});
export function edgeConfig(environment: Record<string,string | undefined>) {
  const values = schema.parse(environment);
  const keys=values.SUPABASE_SECRET_KEYS ? z.record(z.string(),z.string()).parse(JSON.parse(values.SUPABASE_SECRET_KEYS)) : {};
  const serviceKey=keys.default || values.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("The function needs Supabase's server-side default secret key or legacy service-role key.");
  const serviceUrl = serviceBaseUrl(values.SERVICE_PUBLIC_URL,true);
  if (!/^\/functions\/v1\/[a-z\d_-]+$/.test(new URL(serviceUrl).pathname)) throw new Error("Configure the Supabase function's complete public URL.");
  if (new URL(serviceUrl).origin !== new URL(values.SUPABASE_URL).origin) throw new Error("The service and database must belong to the same Supabase project.");
  const privacyUrl = new URL(values.PRIVACY_URL);
  if (privacyUrl.protocol !== "https:" || privacyUrl.username || privacyUrl.password) throw new Error("Publish an HTTPS privacy page.");
  return { serviceUrl,privacyUrl: privacyUrl.href,notionClientId: values.NOTION_CLIENT_ID,notionClientSecret: values.NOTION_CLIENT_SECRET,encryptionKey: values.TOKEN_ENCRYPTION_KEY,extensionId: values.ALLOWED_EXTENSION_ID,publisherName: values.PUBLISHER_NAME,supportEmail: values.SUPPORT_EMAIL,projectUrl: values.SUPABASE_URL,serviceKey,posthogToken: values.POSTHOG_PROJECT_TOKEN,posthogHost: values.POSTHOG_HOST };
}
export type EdgeConfig = ReturnType<typeof edgeConfig>;
