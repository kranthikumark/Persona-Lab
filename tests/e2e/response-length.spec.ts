import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
const headers = { origin: "http://127.0.0.1:3101" };
for (const width of [1440, 320]) {
  test(`V5-02 ${width}px: words, retained drafts, API bypass, IME and separate report length`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 1000 });
    const { sessionId, branchId } = await (
      await page.request.post("/api/sessions", { headers, data: {} })
    ).json();
    try {
      await page.goto(`/sessions/${sessionId}`);
      const input = page.getByRole("textbox", {
        name: "Your response to Priya",
      });
      const send = page.getByRole("button", {
        name: "Send response",
        exact: true,
      });
      const endpoint = `/api/branches/${branchId}/turns`;
      let posted = 0;
      page.on("request", (request) => {
        if (request.method() === "POST" && request.url().endsWith(endpoint))
          posted++;
      });
      await input.fill(Array(71).fill("word").join(" "));
      await expect(page.locator("#response-length")).toContainText(
        "71 / 70 words",
      );
      await expect(page.locator("#response-length")).toContainText("Remove 1");
      await expect(send).toBeDisabled();
      await input.press("Enter");
      expect(posted).toBe(0);
      await page.reload();
      await expect(input).toHaveValue(Array(71).fill("word").join(" "));
      const before = await (
        await page.request.get(`/api/sessions/${sessionId}`)
      ).json();
      for (const text of ["", "... 🙂", Array(71).fill("word").join(" ")]) {
        const rejected = await page.request.post(endpoint, {
          headers,
          data: { text, revision: 0, key: crypto.randomUUID() },
        });
        expect(rejected.status()).toBe(422);
      }
      expect(
        await (await page.request.get(`/api/sessions/${sessionId}`)).json(),
      ).toEqual(before);
      await input.fill("Could we review the 30-day waiting period together?");
      await input.dispatchEvent("compositionstart");
      await input.press("Enter");
      await expect(send).toBeDisabled();
      expect(posted).toBe(0);
      await input.dispatchEvent("compositionend");
      await expect(send).toBeEnabled();
      await send.click();
      await expect(input).toHaveValue("");
      await expect(page.locator("#response-length")).toContainText(
        "0 / 70 words",
      );
      await page.getByRole("button", { name: /Field notes/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("region", { name: "Response length", exact: true }),
      ).toContainText("Passed");
      await expect(
        dialog.getByRole("region", { name: "Response length", exact: true }),
      ).toContainText("separate from quality scores");
      const saved = await (
        await page.request.get(`/api/branches/${branchId}/evaluation`)
      ).json();
      expect(saved.report.totalChecks).toBe(9);
      expect(
        saved.report.categories
          .flatMap((c: { checks: { id: string }[] }) => c.checks)
          .some((c: { id: string }) => c.id === "concise-response"),
      ).toBe(false);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await mkdir("docs/screenshots/v5-02", { recursive: true });
      await page.screenshot({
        path: `docs/screenshots/v5-02/report-${width}.png`,
        fullPage: true,
      });
    } finally {
      expect(
        (
          await page.request.delete(`/api/sessions/${sessionId}`, { headers })
        ).ok(),
      ).toBe(true);
    }
  });
}
