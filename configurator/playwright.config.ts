import { defineConfig } from "@playwright/test";

/* Bundled Chromium only. Never channel:"chrome": that launches the user's real
   Chrome as a competing process. */
export default defineConfig({
  testDir: "e2e",
  webServer: { command: "npm run preview", port: 4173, reuseExistingServer: true },
  /* Four software-WebGL workers share one CPU, and the first paint of the
     outdoor stage (body, HDRI, asphalt maps, wheel geometry) blocks the main
     thread for several seconds at a time, so the default 5 s expect is too
     tight under load. Alone, the stage is ready in 8 to 13 s. */
  expect: { timeout: 15_000 },
  use: { baseURL: "http://localhost:4173/visualize/" },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
