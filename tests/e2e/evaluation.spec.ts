import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import type { SavedEvaluation } from "../../src/components/evaluation";
const headers = { origin: "http://127.0.0.1:3101" };
const inputs = [
  "I understand your concern. Claims are reviewed; approval is never guaranteed. A 30-day waiting period applies.",
  "What is your budget? What was your past experience?",
  "May I send a summary in writing? Take your time to review before you decide.",
];
for (const size of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${size.name}: evidence rubric persists, links to dialogue and marks later turns stale`, async ({
    page,
    playwright,
  }) => {
    await page.setViewportSize(size);
    const created = await page.request.post("/api/sessions", {
      headers,
      data: {},
    });
    expect(created.status()).toBe(200);
    const { sessionId: id, branchId } = await created.json();
    try {
      for (const [revision, text] of inputs.entries()) {
        const turn = await page.request.post(
          `/api/branches/${branchId}/turns`,
          { headers, data: { text, revision, key: crypto.randomUUID() } },
        );
        expect(turn.status()).toBe(200);
      }
      await page.goto(`/sessions/${id}`);
      await page.getByRole("button", { name: /Field notes/ }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Refresh report card" }).click();
      await expect(
        dialog.getByText("10 / 10 checks with recognized evidence"),
      ).toBeVisible();
      await expect(dialog.locator(".evaluation-number")).toContainText("100");
      await expect(
        dialog.getByText(/Revision 3 · through turn 3/),
      ).toBeVisible();
      const saved: SavedEvaluation = await (
        await page.request.get(`/api/branches/${branchId}/evaluation`)
      ).json();
      expect(saved.report.overall).toBe(100);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        audit.violations.map(({ id, nodes }) => ({
          id,
          nodes: nodes.map(({ target, failureSummary }) => ({
            target,
            failureSummary,
          })),
        })),
      ).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await mkdir("docs/screenshots/report-card", { recursive: true });
      await page.screenshot({
        path: `docs/screenshots/report-card/evaluation-${size.name}.png`,
        fullPage: true,
        animations: "disabled",
      });
      const evidence = saved.report.categories[0].checks[0].evidence[0];
      await dialog.locator(".evaluation-evidence a").first().click();
      await expect(dialog).not.toBeVisible();
      await expect(
        page.locator(`#message-${evidence.messageId}`),
      ).toBeInViewport();
      await page.reload();
      await page.getByRole("button", { name: /Field notes/ }).click();
      await expect(
        dialog.getByText("10 / 10 checks with recognized evidence"),
      ).toBeVisible();
      const restored: SavedEvaluation = await (
        await page.request.get(`/api/branches/${branchId}/evaluation`)
      ).json();
      expect(restored.id).toBe(saved.id);
      await page.keyboard.press("Escape");
      await page
        .getByLabel("Your response to Priya")
        .fill("All claims are guaranteed.");
      await page.getByRole("button", { name: "Send response" }).click();
      await expect(page.getByLabel("Your response to Priya")).toHaveValue("");
      await page.getByRole("button", { name: /Field notes/ }).click();
      await expect(dialog.locator(".evaluation-stale")).toContainText(
        "outdated",
      );
      await expect(
        dialog.getByText(/Revision 3 · through turn 3/),
      ).toBeVisible();
      await dialog
        .getByRole("button", { name: "Evaluate current revision" })
        .click();
      await expect(dialog.locator(".evaluation-stale")).toHaveCount(0);
      await expect(dialog.locator(".evaluation-number")).toContainText("85");
      await expect(
        dialog.getByText(/Revision 4 · through turn 4/),
      ).toBeVisible();
      const current: SavedEvaluation = await (
        await page.request.get(`/api/branches/${branchId}/evaluation`)
      ).json();
      expect(current.id).not.toBe(saved.id);
      const outsider = await playwright.request.newContext({
        baseURL: "http://127.0.0.1:3101",
        extraHTTPHeaders: headers,
      });
      try {
        expect(
          (await outsider.get(`/api/branches/${branchId}/evaluation`)).status(),
        ).toBe(404);
        expect(
          (
            await outsider.post(`/api/branches/${branchId}/evaluation`, {
              data: { revision: 4 },
            })
          ).status(),
        ).toBe(404);
      } finally {
        await outsider.dispose();
      }
      expect(
        (
          await page.request.post(`/api/branches/${branchId}/evaluation`, {
            headers,
            data: { revision: 4, findings: { messageId: "fabricated" } },
          })
        ).status(),
      ).toBe(400);
      await mkdir("docs/verification/report-card", { recursive: true });
      await writeFile(
        `docs/verification/report-card/${size.name}.json`,
        `${JSON.stringify(
          {
            verifiedAt: new Date().toISOString(),
            status: "passed",
            provider: "mock",
            viewport: size,
            checks: {
              documentedWeightedScore: true,
              exactEvidenceLink: true,
              persistedReport: true,
              staleAfterNewTurn: true,
              newRevisionReport: true,
              foreignAccessDenied: true,
              clientFindingsRejected: true,
              selectedAxeRules: true,
              noHorizontalOverflow: true,
            },
            originalReport: saved.report,
            currentReport: current.report,
            cleanup:
              "The test deletes only its own session; record IDs are historical evidence.",
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      expect(
        (
          await page.request.delete(`/api/sessions/${id}`, { headers })
        ).status(),
      ).toBe(200);
    }
  });
}

test("comparison evaluates each full path and distinguishes shared evidence from after-fork evidence", async ({
  page,
}) => {
  const created = await page.request.post("/api/sessions", {
    headers,
    data: {},
  });
  const { sessionId: id, branchId } = await created.json();
  try {
    await page.request.post(`/api/branches/${branchId}/turns`, {
      headers,
      data: {
        text: "All claims are guaranteed.",
        revision: 0,
        key: crypto.randomUUID(),
      },
    });
    const parent = await (await page.request.get(`/api/sessions/${id}`)).json();
    const fork = await page.request.post(`/api/branches/${branchId}/forks`, {
      headers,
      data: { snapshotId: parent.snapshots.at(-1).id, name: "Explain terms" },
    });
    const { branchId: child } = await fork.json();
    await page.request.post(`/api/branches/${child}/turns`, {
      headers,
      data: { text: inputs[0], revision: 0, key: crypto.randomUUID() },
    });
    await page.goto(`/sessions/${id}/compare?left=${branchId}&right=${child}`);
    const columns = page.locator(".compare-column");
    for (const index of [0, 1]) {
      await columns
        .nth(index)
        .locator(".comparison-evaluation > summary")
        .click();
      await columns
        .nth(index)
        .getByRole("button", { name: "Refresh report card" })
        .click();
      await expect(
        columns.nth(index).locator(".evaluation-number"),
      ).toContainText("/ 100");
    }
    const right = columns.last();
    await expect(right.locator(".report-scope").first()).toContainText(
      "through turn 2",
    );
    await right
      .getByRole("region", { name: "Factual accuracy / compliance" })
      .locator("summary")
      .click();
    await expect(
      right
        .locator(".evaluation-evidence")
        .getByRole("link", { name: "Turn 1 · Shared history" }),
    ).toBeVisible();
    await expect(
      right
        .locator(".evaluation-evidence")
        .getByRole("link", { name: "Turn 2 · After fork" }),
    ).toBeVisible();
    const report: SavedEvaluation = await (
      await page.request.get(`/api/branches/${child}/evaluation`)
    ).json();
    expect(report.report.categories[0].score).toBe(50);
    await right
      .locator(".evaluation-evidence")
      .getByRole("link", { name: "Turn 1 · Shared history" })
      .click();
    await expect(
      page.locator(
        `#message-${report.report.categories[0].checks[0].evidence[0].messageId}`,
      ),
    ).toBeInViewport();
  } finally {
    expect(
      (await page.request.delete(`/api/sessions/${id}`, { headers })).status(),
    ).toBe(200);
  }
});
