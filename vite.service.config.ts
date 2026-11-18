import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "server/index.ts", target: "node24", outDir: "build-service", sourcemap: false,
    rollupOptions: { output: { entryFileNames: "index.mjs" } },
  },
});
