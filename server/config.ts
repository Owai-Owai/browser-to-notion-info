import { z } from "zod";
import { serviceOrigin } from "../shared/service-url";

const schema = z.object({
  PORT: z.coerce.number().int().min(1024).max(65535).default(4318),
  NOTION_CLIENT_ID: z.string().default(""), NOTION_CLIENT_SECRET: z.string().default(""),
  NOTION_REDIRECT_URI: z.string().url().default("http://localhost:4318/oauth/callback"),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[a-f\d]{64}$/i, "Run npm run setup:local to create the local encryption key."),
  ALLOWED_EXTENSION_ID: z.string().regex(/^[a-p]{32}$/, "Run npm run setup:local to configure the extension ID."),
  DATA_DIRECTORY: z.string().default(".data"),
  SERVICE_MODE: z.enum(["local", "hosted"]).default("local"),
  SERVICE_PUBLIC_URL: z.string().optional(),
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
  CLIENT_IP_HEADER: z.enum(["x-forwarded-for", "cf-connecting-ip"]).default("x-forwarded-for"),
  PUBLISHER_NAME: z.string().min(1).default("Browser to Notion"),
  SUPPORT_EMAIL: z.string().email().optional(),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().min(0).max(365).default(7),
}).superRefine((value, context) => {
  if (value.SERVICE_MODE !== "hosted") return;
  try {
    const origin = serviceOrigin(value.SERVICE_PUBLIC_URL, true);
    if (value.NOTION_REDIRECT_URI !== `${origin}/oauth/callback`) throw new Error("Set the OAuth redirect to the public service's /oauth/callback URL.");
  } catch (error) { context.addIssue({ code: "custom", message: error instanceof Error ? error.message : "Configure a public service URL." }); }
  if (!value.SUPPORT_EMAIL) context.addIssue({ code: "custom", message: "Set SUPPORT_EMAIL for the public privacy policy." });
  if (!value.NOTION_CLIENT_ID || !value.NOTION_CLIENT_SECRET || /YOUR_|CHANGE_ME/.test(`${value.NOTION_CLIENT_ID} ${value.NOTION_CLIENT_SECRET}`)) context.addIssue({ code: "custom", message: "Configure the publisher's Notion OAuth credentials before starting the hosted service." });
});
export const config = schema.parse(process.env);
export const oauthConfigured = !!config.NOTION_CLIENT_ID && !!config.NOTION_CLIENT_SECRET && !config.NOTION_CLIENT_ID.includes("YOUR_");
export const hosted = config.SERVICE_MODE === "hosted";
export const publicOrigin = hosted ? serviceOrigin(config.SERVICE_PUBLIC_URL, true) : `http://127.0.0.1:${config.PORT}`;
