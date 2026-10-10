import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: /ai-exhibition\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:4174", trace: "retain-on-failure" },
  webServer: {
    command:
      "RELEASE_PROFILE=ai-exhibition npm run dev -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
