import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: ["polish.spec.ts", "manual-acceptance.spec.ts"],
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
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
