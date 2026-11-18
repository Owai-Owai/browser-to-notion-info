import { createHash,randomBytes } from "node:crypto";
import { readFileSync,existsSync,writeFileSync } from "node:fs";

const { key }=JSON.parse(readFileSync("extension.config.json","utf8"));
const id=[...createHash("sha256").update(Buffer.from(key,"base64")).digest().subarray(0,16)].map(byte=>String.fromCharCode(97+(byte>>4),97+(byte&15))).join("");
if (!existsSync(".env.supabase.local")) {
  writeFileSync(".env.supabase.local",`SERVICE_PUBLIC_URL=\nPRIVACY_URL=\nNOTION_CLIENT_ID=\nNOTION_CLIENT_SECRET=\nTOKEN_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}\nALLOWED_EXTENSION_ID=${id}\nPUBLISHER_NAME=\nSUPPORT_EMAIL=\n`,{ mode: 0o600 });
  console.info("Created .env.supabase.local with a new encryption key. Add the project URL, publisher details, and Notion credentials directly in that file.");
} else console.info("Kept the existing .env.supabase.local and encryption key unchanged.");
console.info(`Current extension ID: ${id}`);
console.info("Follow docs/SUPABASE-SETUP.md. No local pilot credentials or settings were changed.");
