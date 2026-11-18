import { randomBytes } from "node:crypto";
import { db, encrypt, hash, type StoredConnection } from "./database";

interface OAuthTokens { access_token: string; refresh_token?: string; workspace_id: string; workspace_name?: string | null }

/** Workspace IDs are shared by users. Only a proven existing session may reuse a record. */
export function saveOAuthConnection(tokens: OAuthTokens, existingId?: string | null): string {
  const existing = existingId ? db.prepare("SELECT id, workspace_id FROM bns_connections WHERE id = ?").get(existingId) as Pick<StoredConnection, "id" | "workspace_id"> | undefined : undefined;
  const id = existing?.workspace_id === tokens.workspace_id ? existing.id : randomBytes(32).toString("hex");
  db.prepare("INSERT INTO bns_connections(id, session_hash, encrypted_tokens, workspace_id, workspace_name, last_seen) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET encrypted_tokens=excluded.encrypted_tokens, workspace_name=excluded.workspace_name, last_seen=excluded.last_seen").run(id, hash(randomBytes(32).toString("base64url")), encrypt(tokens), tokens.workspace_id, tokens.workspace_name || "Notion workspace", Date.now());
  return id;
}
