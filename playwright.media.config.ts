import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
process.env.PERSONA_MEDIA_TEST_STORAGE ||= path.join(
  tmpdir(),
  `persona-v510-browser-${randomUUID()}`,
);
export default defineConfig({
  testDir: "tests/media",
  workers: 1,
  timeout: 60000,
  globalTeardown: "./tests/media/cleanup.ts",
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [
    {
      name: "media-chromium",
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
    timeout: 120000,
    env: {
      AI_PROVIDER: "mock",
      META_API_KEY: "",
      SIMLI_API_KEY: "",
      APP_ORIGIN: "http://127.0.0.1:3101",
      PERSONA_PHONE_REVIEW: "1",
      PERSONA_ACCEPTANCE_RUN: randomUUID(),
      PERSONA_MEDIA_DIR: process.env.PERSONA_MEDIA_TEST_STORAGE,
    },
  },
});
