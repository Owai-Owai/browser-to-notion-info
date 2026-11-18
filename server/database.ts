import { DatabaseSync } from "node:sqlite";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "./config";

mkdirSync(config.DATA_DIRECTORY, { recursive: true });
export const db = new DatabaseSync(join(config.DATA_DIRECTORY, "bookmark-sync.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;
  CREATE TABLE IF NOT EXISTS bns_connections (
    id TEXT PRIMARY KEY, session_hash TEXT UNIQUE NOT NULL, encrypted_tokens TEXT NOT NULL,
    workspace_id TEXT NOT NULL, workspace_name TEXT NOT NULL, last_seen INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bns_flows (
    state TEXT PRIMARY KEY, challenge TEXT NOT NULL, expires INTEGER NOT NULL,
    ticket_hash TEXT, connection_id TEXT, existing_connection_id TEXT
  );
  CREATE TABLE IF NOT EXISTS bns_operations (
    owner TEXT NOT NULL, operation_id TEXT NOT NULL, resource_key TEXT NOT NULL,
    state TEXT NOT NULL, page_id TEXT, page_url TEXT, updated_at INTEGER NOT NULL,
    PRIMARY KEY(owner, operation_id)
  );
  CREATE INDEX IF NOT EXISTS bns_resource ON bns_operations(owner, resource_key);
`);
// Preserve pilot databases while adding the installation's optional reconnect target.
const flowColumns = db.prepare("PRAGMA table_info(bns_flows)").all() as { name: string }[];
if (!flowColumns.some(column => column.name === "existing_connection_id")) db.exec("ALTER TABLE bns_flows ADD COLUMN existing_connection_id TEXT");

export function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function encrypt(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(config.TOKEN_ENCRYPTION_KEY, "hex"), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
export function decrypt(value: string): unknown {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(config.TOKEN_ENCRYPTION_KEY, "hex"), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}

export interface StoredConnection { id: string; encrypted_tokens: string; workspace_id: string; workspace_name: string }
export function getConnection(session: string): StoredConnection | undefined {
  return db.prepare("SELECT id, encrypted_tokens, workspace_id, workspace_name FROM bns_connections WHERE session_hash = ? AND last_seen > ?").get(hash(session), Date.now() - 90 * 86400_000) as StoredConnection | undefined;
}
export function cleanup() {
  db.prepare("DELETE FROM bns_flows WHERE expires < ?").run(Date.now());
  const expired = db.prepare("SELECT id FROM bns_connections WHERE last_seen < ?").all(Date.now() - 90 * 86400_000) as { id: string }[];
  for (const row of expired) db.prepare("DELETE FROM bns_operations WHERE owner = ?").run(row.id);
  db.prepare("DELETE FROM bns_connections WHERE last_seen < ?").run(Date.now() - 90 * 86400_000);
}
