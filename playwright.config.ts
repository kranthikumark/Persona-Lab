import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    env: {
      AI_PROVIDER: "mock",
      APP_ORIGIN: "http://127.0.0.1:3101",
      PERSONA_ACCEPTANCE_RUN: randomUUID(),
    },
    timeout: 120000,
  },
});
