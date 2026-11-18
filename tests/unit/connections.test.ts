import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.TOKEN_ENCRYPTION_KEY = "b".repeat(64);
process.env.ALLOWED_EXTENSION_ID = "b".repeat(32);
process.env.DATA_DIRECTORY = mkdtempSync(join(tmpdir(), "bns-connections-"));
const { db, hash, getConnection } = await import("../../server/database");
const { saveOAuthConnection } = await import("../../server/connections");
const tokens = { access_token: "test-only-access", workspace_id: "same-workspace", workspace_name: "Shared workspace" };

beforeEach(() => db.exec("DELETE FROM bns_operations; DELETE FROM bns_connections"));
afterAll(() => db.close());

describe("installation isolation", () => {
  it("gives two installations independent records even in the same workspace", () => {
    const first = saveOAuthConnection(tokens);
    const second = saveOAuthConnection(tokens);
    expect(first).not.toBe(second);
    db.prepare("UPDATE bns_connections SET session_hash = ? WHERE id = ?").run(hash("first-session"), first);
    db.prepare("UPDATE bns_connections SET session_hash = ? WHERE id = ?").run(hash("second-session"), second);
    db.prepare("DELETE FROM bns_connections WHERE id = ?").run(first);
    expect(getConnection("first-session")).toBeUndefined();
    expect(getConnection("second-session")?.id).toBe(second);
  });
  it("retains the installation's save ledger during a proven reconnect", () => {
    const original = saveOAuthConnection(tokens);
    db.prepare("INSERT INTO bns_operations(owner,operation_id,resource_key,state,updated_at) VALUES(?,?,?,'uncertain',?)").run(original, "pending-operation", "resource", Date.now());
    expect(saveOAuthConnection({ ...tokens, access_token: "refreshed-token" }, original)).toBe(original);
    expect(db.prepare("SELECT state FROM bns_operations WHERE owner = ?").get(original)).toEqual({ state: "uncertain" });
  });
  it("does not reuse a different workspace's record or an expired reconnect target", () => {
    const first = saveOAuthConnection(tokens);
    expect(saveOAuthConnection({ ...tokens, workspace_id: "different-workspace" }, first)).not.toBe(first);
    expect(saveOAuthConnection(tokens, "deleted-installation")).not.toBe(first);
  });
});
