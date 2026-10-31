import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/speech",
  workers: 1,
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [
    {
      name: "speech-chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CI ? undefined : "chrome",
        launchOptions: { args: ["--use-fake-device-for-media-stream"] },
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
      SIMLI_API_KEY: "",
      SIMLI_FACE_ID: "",
      META_API_KEY: "synthetic-never-used-for-network",
      APP_ORIGIN: "http://127.0.0.1:3101",
      PERSONA_ACCEPTANCE_RUN: randomUUID(),
      PERSONA_LOCALE_ACCEPTANCE: "1",
      PERSONA_PHONE_REVIEW: "1",
    },
  },
});
