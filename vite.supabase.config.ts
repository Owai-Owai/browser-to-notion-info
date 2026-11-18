import { defineConfig } from "vite";
import { resolve } from "node:path";

// A self-contained function bundle avoids deploying imports from outside functions/.
export default defineConfig({
  build: {
    target: "es2023",outDir: "supabase/functions/notion-sync/dist",sourcemap: false,minify: false,
    lib: { entry: resolve("supabase/functions/notion-sync/index.ts"),formats: ["es"],fileName: () => "index.js" },
  },
});
