import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e", fullyParallel: false, workers: 1, timeout: 30_000,
  use: { ...devices["Desktop Edge"], channel: "msedge", baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --port 5173 --strictPort", url: "http://127.0.0.1:5173/options.html", reuseExistingServer: true },
});
