import { test, expect } from "@playwright/test";

for (const host of ["localhost", "127.0.0.1"]) {
  test(`Begin practice works from ${host} with a real browser origin`, async ({
    page,
  }) => {
    const origin = `http://${host}:3101`;
    await page.goto(origin);
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/sessions") &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Begin practice", exact: true })
      .first()
      .click();
    const response = await created;
    expect(response.status()).toBe(200);
    const { sessionId } = await response.json();
    try {
      await expect(page).toHaveURL(new RegExp(`/sessions/${sessionId}$`));
      await expect(page.getByLabel("Your response to Priya")).toBeVisible();
      const rejected = await page.request.post(`${origin}/api/sessions`, {
        headers: { origin: "https://foreign.example" },
        data: {},
      });
      expect(rejected.status()).toBe(403);
    } finally {
      expect(
        (
          await page.request.delete(`${origin}/api/sessions/${sessionId}`, {
            headers: { origin },
          })
        ).status(),
      ).toBe(200);
    }
  });
}
