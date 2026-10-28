import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const headers = { origin: "http://127.0.0.1:3101" };

for (const theme of ["light", "dark"]) {
  test(`${theme}: every session has a numeric report card with honest positives, concerns and improvements`, async ({
    page,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("persona-lab-theme", theme),
      theme,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    const created = await page.request.post("/api/sessions", {
      headers,
      data: {},
    });
    expect(created.ok()).toBe(true);
    const { sessionId, branchId } = await created.json();
    try {
      await page.goto(`/sessions/${sessionId}`);
      await page.getByRole("button", { name: /Field notes/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: "Session report card" }),
      ).toBeVisible();
      await expect(dialog.locator(".evaluation-number")).toContainText("0");
      await expect(dialog.locator(".report-readiness")).toHaveText(
        "Not started · no responses yet",
      );
      await expect(
        dialog.getByRole("region", { name: "Positives" }),
      ).toContainText("No strengths evidenced yet");
      await expect(
        dialog.getByRole("region", { name: "Needs attention" }),
      ).toContainText("No negative findings");
      await expect(
        dialog.getByRole("region", { name: "What to improve" }),
      ).toContainText("Ask about budget");
      const turn = await page.request.post(`/api/branches/${branchId}/turns`, {
        headers,
        data: {
          text: "All claims are guaranteed.",
          revision: 0,
          key: crypto.randomUUID(),
        },
      });
      expect(turn.ok()).toBe(true);
      await page.reload();
      await page.getByRole("button", { name: /Field notes/ }).click();
      await dialog
        .getByRole("button", { name: "Evaluate current revision" })
        .click();
      await expect(dialog.locator(".evaluation-number")).toContainText("8");
      await expect(dialog.locator(".report-readiness")).toContainText(
        "Provisional",
      );
      await expect(
        dialog.getByRole("region", { name: "Positives" }),
      ).toContainText("Your responses stayed within the length guideline.");
      await expect(
        dialog.getByRole("region", { name: "Needs attention" }),
      ).toContainText("Explain claim review without guarantees");
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          result.violations.map(({ id, nodes }) => ({
            id,
            nodes: nodes.map(({ target, failureSummary }) => ({
              target,
              failureSummary,
            })),
          })),
        ).toEqual([]);
        await page.screenshot({
          path: `/tmp/persona-report-${theme}-${width}.png`,
          fullPage: true,
        });
      }
      const saved = await (
        await page.request.get(`/api/branches/${branchId}/evaluation`)
      ).json();
      expect(saved.report.overall).toBe(8);
      await page.reload();
      await page.getByRole("button", { name: /Field notes/ }).click();
      await expect(dialog.locator(".evaluation-number")).toContainText("8");
      const restored = await (
        await page.request.get(`/api/branches/${branchId}/evaluation`)
      ).json();
      expect(restored.id).toBe(saved.id);
      const target = await dialog
        .getByRole("region", { name: "Needs attention" })
        .getByRole("link")
        .first()
        .getAttribute("href");
      await dialog
        .getByRole("region", { name: "Needs attention" })
        .getByRole("link")
        .first()
        .click();
      await expect(dialog).not.toBeVisible();
      await expect(page.locator(target!)).toBeFocused();
    } finally {
      expect(
        (
          await page.request.delete(`/api/sessions/${sessionId}`, { headers })
        ).ok(),
      ).toBe(true);
    }
  });
}
