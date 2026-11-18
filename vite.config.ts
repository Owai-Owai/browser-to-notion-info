import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { serviceBaseUrl } from "./shared/service-url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicBuild = mode === "public";
  const origin = serviceBaseUrl(env.VITE_SERVICE_URL, publicBuild);
  const privacyUrl = env.VITE_PRIVACY_URL || `${origin}/privacy`;
  if (publicBuild && new URL(origin).pathname.startsWith("/functions/v1/") && !env.VITE_PRIVACY_URL) throw new Error("Set VITE_PRIVACY_URL to your published HTTPS privacy page.");
  if (publicBuild && (new URL(privacyUrl).protocol !== "https:" || /YOUR_|CHANGE_ME/i.test(privacyUrl))) throw new Error("Publish an HTTPS privacy page before the public build.");
  const version = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;
  return {
    plugins: [react(), tailwindcss(), {
      name: "extension-manifest",
      generateBundle() {
        const project = JSON.parse(readFileSync("extension.config.json", "utf8")) as { key: string; localKey?: string };
        const key = publicBuild ? project.key : project.localKey ?? project.key;
        this.emitFile({ type: "asset",fileName: "connection.json",source: JSON.stringify({ serviceUrl: origin,privacyUrl },null,2) });
        this.emitFile({ type: "asset", fileName: "manifest.json", source: JSON.stringify({
          manifest_version: 3, name: "Browser to Notion", version,
          description: "Your Chrome bookmarks, quietly saved to your Notion collection.",
          key, minimum_chrome_version: "120",
          permissions: ["bookmarks", "storage", "alarms", "identity"],
          host_permissions: [`${new URL(origin).origin}/*`],
          action: { default_popup: "popup.html", default_title: "Browser to Notion" },
          options_page: "options.html",
          background: { service_worker: "background.js", type: "module" },
          icons: { "16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png" },
          content_security_policy: { extension_pages: "script-src 'self'; object-src 'none'" },
          incognito: "not_allowed"
        }, null, 2) });
      }
    }],
    resolve: { alias: { "@": resolve(process.cwd(), "src") } },
    build: { outDir: publicBuild ? "dist-public" : "dist", sourcemap: !publicBuild, rollupOptions: {
      input: { popup: resolve("popup.html"), options: resolve("options.html"), background: resolve("src/background/index.ts") },
      output: { entryFileNames: chunk => chunk.name === "background" ? "background.js" : "assets/[name]-[hash].js" }
    } }
  };
});
