import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const directory = process.argv[2] || "dist";
const publicBuild = process.argv.includes("--public");
const manifest = JSON.parse(readFileSync(join(directory, "manifest.json"), "utf8"));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual([...manifest.permissions].sort(), ["alarms", "bookmarks", "identity", "storage"]);
if (publicBuild) {
  assert.equal(manifest.host_permissions.length, 1);
  assert.ok(manifest.host_permissions[0].startsWith("https://"), "The public package must use HTTPS.");
} else assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1:4318/*"]);
for (const asset of [manifest.action.default_popup, manifest.options_page, manifest.background.service_worker, ...Object.values(manifest.icons)]) assert.ok(existsSync(join(directory, asset)), `Missing extension asset: ${asset}`);
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
const packagedFiles = files(directory);
const output = packagedFiles.filter(file => /\.(js|json|map|html)$/.test(file)).map(file => readFileSync(file, "utf8")).join("\n");
if (publicBuild) {
  assert.ok(!packagedFiles.some(file => file.endsWith(".map") || /(?:^|[\\/])\.env/.test(file)), "The public package must not contain source maps or environment files.");
  for (const previewText of ["preview-only", "Personal workspace (sample)", "Design preview · Sample data", "docs/LOCAL-SETUP.md", "YOUR_SERVICE"]) assert.ok(!output.includes(previewText), "The public package still contains preview data or development setup text.");
}
for (const envFile of [".env.local",".env.supabase.local"]) if (existsSync(envFile)) {
  const env = readFileSync(envFile, "utf8");
  for (const name of ["NOTION_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY","SUPABASE_SERVICE_ROLE_KEY"]) {
    const secret = env.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim();
    if (secret) assert.ok(!output.includes(secret), `A private service value was found in the extension build (${name}).`);
  }
}
assert.ok(!/\bsb_secret_[a-z\d_-]{20,}/i.test(output),"A Supabase server key was found in the extension build.");
assert.ok(!output.includes("https://api.notion.com/v1/oauth/token"), "Notion token exchange must stay in the connection backend.");
console.info("Verified manifest, packaged assets, permission scope, and separation of service secrets.");
