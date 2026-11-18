import { generateKeyPairSync, createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

if (!existsSync("extension.config.json")) {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  writeFileSync("extension.config.json", JSON.stringify({ key: publicKey.export({ type: "spki", format: "der" }).toString("base64") }, null, 2) + "\n");
}
const project = JSON.parse(readFileSync("extension.config.json", "utf8"));
const key = project.localKey ?? project.key;
const id = [...createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16)].map(byte => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join("");
if (!existsSync(".env.local")) {
  writeFileSync(".env.local", `VITE_SERVICE_URL=http://127.0.0.1:4318\nPORT=4318\nNOTION_CLIENT_ID=\nNOTION_CLIENT_SECRET=\nNOTION_REDIRECT_URI=http://localhost:4318/oauth/callback\nTOKEN_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}\nALLOWED_EXTENSION_ID=${id}\n`, { mode: 0o600 });
  console.info("Created .env.local with a local encryption key. Add Notion credentials there; do not share this file.");
} else {
  const existing = readFileSync(".env.local", "utf8");
  const corrected = existing.replace(/^NOTION_REDIRECT_URI=http:\/\/127\.0\.0\.1:4318\/oauth\/callback\r?$/m, "NOTION_REDIRECT_URI=http://localhost:4318/oauth/callback");
  if (corrected !== existing) {
    writeFileSync(".env.local", corrected, { mode: 0o600 });
    console.info("Updated the legacy IP callback to localhost. All other local settings and credentials were preserved.");
  } else console.info("Kept your existing .env.local unchanged.");
}
console.info(`Stable Chrome extension ID: ${id}`);
console.info("OAuth callback: http://localhost:4318/oauth/callback");
