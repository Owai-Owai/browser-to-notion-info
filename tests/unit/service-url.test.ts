import { describe, expect, it } from "vitest";
import { serviceOrigin,serviceBaseUrl } from "../../shared/service-url";

describe("release service configuration", () => {
  it("preserves the local pilot and accepts a hosted HTTPS origin", () => {
    expect(serviceOrigin()).toBe("http://127.0.0.1:4318");
    expect(serviceOrigin("https://bookmarks.onrender.com/", true)).toBe("https://bookmarks.onrender.com");
  });
  it("refuses a public build using local, insecure, or private service addresses", () => {
    for (const value of [undefined, "http://127.0.0.1:4318", "https://localhost", "http://api.example.com", "https://192.168.1.4", "https://service.local", "https://service.invalid"]) expect(() => serviceOrigin(value, true)).toThrow();
  });
  it("rejects credentials, paths, and query strings that could diverge from permissions", () => {
    for (const value of ["https://person:password@api.example.com", "https://api.example.com/v1", "https://api.example.com?token=secret"]) expect(() => serviceOrigin(value, true)).toThrow();
  });
  it("preserves a Supabase function prefix without accepting unrelated API paths",() => {
    expect(serviceBaseUrl("https://project.supabase.co/functions/v1/notion-sync/",true)).toBe("https://project.supabase.co/functions/v1/notion-sync");
    expect(serviceBaseUrl()).toBe("http://127.0.0.1:4318");
    expect(() => serviceBaseUrl("https://project.supabase.co/rest/v1/connections",true)).toThrow();
    expect(() => serviceBaseUrl("http://127.attacker.example",false)).toThrow();
  });
});
