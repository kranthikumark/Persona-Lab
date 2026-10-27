import { defineConfig, devices } from "@playwright/test";

if (process.env.PERSONA_LIVE_VERIFY !== "1") {
  throw new Error(
    "Live verification makes real Meta requests. Run with PERSONA_LIVE_VERIFY=1 only when intended.",
  );
}

export default defineConfig({
  testDir: "tests/live",
  workers: 1,
  retries: 0,
  timeout: 300000,
  expect: { timeout: 45000 },
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "live-chrome",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
});
