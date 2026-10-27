import { test, expect } from "@playwright/test";
const headers = { origin: "http://127.0.0.1:3101" };

test("screen titles identify studio, history, practice and comparison", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Scenario studio · PERSONA LAB");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Practice history", exact: true })
    .click();
  await expect(page).toHaveTitle("Practice history · PERSONA LAB");
  const response = await page.request.post("/api/sessions", {
    headers,
    data: {},
  });
  const { sessionId } = await response.json();
  try {
    await page.goto(`/sessions/${sessionId}`);
    await expect(page).toHaveTitle("Practice conversation · PERSONA LAB");
    await page.goto(`/sessions/${sessionId}/compare`);
    await expect(page).toHaveTitle("Compare approaches · PERSONA LAB");
  } finally {
    expect(
      (
        await page.request.delete(`/api/sessions/${sessionId}`, { headers })
      ).ok(),
    ).toBe(true);
  }
});

test("keyboard response keeps composer focus through delayed generation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, "randomUUID", { value: undefined });
  });
  const response = await page.request.post("/api/sessions", {
    headers,
    data: {},
  });
  const { sessionId } = await response.json();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/turns", async (route) => {
    await held;
    await route.continue();
  });
  try {
    await page.goto(`/sessions/${sessionId}`);
    const input = page.getByLabel("Your response to Priya");
    await input.fill("What is your budget?");
    await input.press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: "Preparing Priya" }),
    ).toBeVisible();
    await expect(input).toBeFocused();
    release();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await input.press("Shift+Enter");
    await expect(input).toHaveValue("\n");
    await input.fill("Please explain the exclusions.");
    const send = page.getByRole("button", { name: "Send response" });
    await send.focus();
    await send.press("Enter");
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
    expect(
      (
        await page.request.delete(`/api/sessions/${sessionId}`, { headers })
      ).ok(),
    ).toBe(true);
  }
});
