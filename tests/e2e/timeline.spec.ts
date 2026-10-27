import { test, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import type { SessionView } from "../../src/lib/client";

test("timeline previews exact saved states and message rewind selects the pre-response boundary", async ({
  page,
}) => {
  const headers = { origin: "http://127.0.0.1:3101" };
  const created = await page.request.post("/api/sessions", {
    headers,
    data: {},
  });
  expect(created.status()).toBe(200);
  const { sessionId, branchId } = await created.json();
  try {
    let saved!: SessionView;
    const prompts = [
      "What is your budget?",
      "All claims are guaranteed.",
      "May I send a summary?",
    ];
    for (const [revision, text] of prompts.entries()) {
      const response = await page.request.post(
        `/api/branches/${branchId}/turns`,
        {
          headers,
          data: { text, revision, key: crypto.randomUUID() },
        },
      );
      expect(response.status()).toBe(200);
      saved = await response.json();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("log")).toContainText(prompts[2]);
    const timeline = page.locator(".timeline-item");
    await expect(timeline).toHaveCount(4);
    for (const [index, snapshot] of saved.snapshots.entries()) {
      expect(snapshot.turnNumber).toBe(index);
      await expect(timeline.nth(index)).toContainText(
        index === 0 ? "The starting point" : `Decision 0${index}`,
      );
    }
    await expect(page.locator(".timeline-item.current")).toContainText(
      "Decision 03",
    );
    await page
      .getByRole("button", { name: "Try another response" })
      .nth(1)
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("after decision 1");
    await expect(dialog.locator("blockquote")).toHaveText(prompts[1]);
    await expect(dialog.locator(".state-indicators")).toContainText(
      "None flagged",
    );
    await expect(dialog.locator(".state-indicators b")).toHaveAttribute(
      "style",
      `width: ${saved.snapshots[1].state.trust}%;`,
    );
    await page.keyboard.press("Escape");
    await timeline.nth(2).click();
    await expect(dialog).toContainText("after decision 2");
    await expect(dialog.locator("blockquote")).toHaveText(prompts[2]);
    await expect(
      dialog.locator(".state-indicators > div").nth(2).locator("strong"),
    ).toHaveText("1");
    await expect(dialog.locator(".state-indicators b")).toHaveAttribute(
      "style",
      `width: ${saved.snapshots[2].state.trust}%;`,
    );
    await page.evaluate(() => document.fonts.ready);
    await mkdir("docs/screenshots/phase-3", { recursive: true });
    await page.screenshot({
      path: "docs/screenshots/phase-3/saved-state-preview.png",
      fullPage: true,
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await page.reload();
    const reloaded = await page.request.get(`/api/sessions/${sessionId}`);
    const actual: SessionView = await reloaded.json();
    expect(actual.snapshots).toEqual(saved.snapshots);
    expect(actual.events).toEqual(saved.events);
    await expect(page.locator(".timeline-item.current")).toContainText(
      "Decision 03",
    );
    await mkdir("docs/verification/phase-3", { recursive: true });
    await writeFile(
      "docs/verification/phase-3/timeline.json",
      `${JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          provider: "mock",
          status: "passed",
          checks: {
            orderedTimeline: true,
            preResponseBoundary: true,
            exactSavedStatePreview: true,
            reloadPreservesSnapshotsAndEvents: true,
          },
          snapshotStates: saved.snapshots.map(({ turnNumber, state }) => ({
            turnNumber,
            state,
          })),
          cleanup: "The test deletes only its own session in finally.",
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    expect(
      (
        await page.request.delete(`/api/sessions/${sessionId}`, { headers })
      ).status(),
    ).toBe(200);
  }
});
