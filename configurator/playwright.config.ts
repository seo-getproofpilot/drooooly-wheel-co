import { defineConfig } from "@playwright/test";

/* Bundled Chromium only. Never channel:"chrome": that launches the user's real
   Chrome as a competing process. */
export default defineConfig({
  testDir: "e2e",
  webServer: { command: "npm run preview", port: 4173, reuseExistingServer: true },
  use: { baseURL: "http://localhost:4173/visualize/" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
