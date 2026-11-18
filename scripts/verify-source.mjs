import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync,readFileSync } from "node:fs";
import { isUtf8 } from "node:buffer";

const listed = spawnSync("git",["ls-files","--cached","--others","--exclude-standard","-z"],{ encoding: "utf8" });
assert.equal(listed.status,0,"Could not list repository source files.");
const files = [...new Set(listed.stdout.split("\0").filter(Boolean))];
const examples = new Set([".env.example",".env.public.example",".env.supabase.example"]);
const privateValues = [];
for (const file of [".env.local",".env.supabase.local"]) if (existsSync(file)) {
  for (const line of readFileSync(file,"utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]*(?:SECRET|TOKEN|KEY|PASSWORD)[A-Z_]*)=(.+)$/);
    if (match && match[2].trim().length >= 20) privateValues.push({ name: match[1],value: match[2].trim().replace(/^['"]|['"]$/g,"") });
  }
}
const credentialPatterns = [
  /\b(?:secret_|ntn_|phx_|phc_|sb_secret_)[A-Za-z0-9_-]{24,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{24,}\b/,
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,
];
for (const file of files) {
  assert.ok(!/(?:^|\/)\.env/.test(file) || examples.has(file),`Private environment file in source: ${file}`);
  assert.ok(!/^(?:\.data|node_modules|dist|dist-public|build-service|release|public-site|docs\/screenshots|research)\//.test(file),`Local artifact in source: ${file}`);
  const data = readFileSync(file);
  if (!isUtf8(data)) continue;
  const text = data.toString("utf8");
  for (const secret of privateValues) assert.ok(!text.includes(secret.value),`Private ${secret.name} value found in ${file}`);
  for (const pattern of credentialPatterns) assert.ok(!pattern.test(text),`Credential-like content found in ${file}; inspect locally before committing.`);
}
console.info(`Verified ${files.length} source files: local artifacts and known private credentials are excluded.`);
