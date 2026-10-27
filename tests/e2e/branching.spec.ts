import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import type { SessionView } from "../../src/lib/client";

const headers = { origin: "http://127.0.0.1:3101" };
for (const size of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${size.name}: fork a nonzero decision, compare recorded changes, follow evidence and resume either path`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    if (size.name === "mobile")
      await page.emulateMedia({ reducedMotion: "reduce" });
    let generatedRequests = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        /\/turns$/.test(new URL(request.url()).pathname)
      )
        generatedRequests++;
    });
    const created = await page.request.post("/api/sessions", {
      headers,
      data: {},
    });
    const { sessionId: id, branchId: root } = await created.json();
    try {
      let original!: SessionView;
      const prompts = [
        "All claims are guaranteed.",
        "What is your budget?",
        "I guarantee claim approval.",
      ];
      for (const [revision, text] of prompts.entries()) {
        const response = await page.request.post(
          `/api/branches/${root}/turns`,
          {
            headers,
            data: { text, revision, key: crypto.randomUUID() },
          },
        );
        expect(response.status()).toBe(200);
        original = await response.json();
      }
      await page.goto(`/sessions/${id}`);
      await expect(page.getByRole("log")).toContainText(prompts[2]);
      await page
        .getByRole("button", { name: "Try another response" })
        .nth(1)
        .click();
      await expect(page.getByRole("dialog")).toContainText("after decision 1");
      await page
        .getByLabel("Name this approach")
        .fill("Clarify the exclusions");
      const forkResponse = page.waitForResponse((response) =>
        /\/forks$/.test(new URL(response.url()).pathname),
      );
      await page
        .getByRole("button", { name: "Create alternative path" })
        .click();
      const { branchId: child } = await (await forkResponse).json();
      await expect(page).toHaveURL(new RegExp(`branch=${child}`));
      await expect(page.getByRole("log")).toContainText(prompts[0]);
      await expect(page.getByRole("log")).not.toContainText(prompts[1]);
      const draft =
        "Claims are reviewed, not guaranteed. Let's discuss exclusions.";
      await page.getByLabel("Your response to Priya").fill(draft);
      await page.getByRole("button", { name: "Send response" }).click();
      await expect(page.getByLabel("Your response to Priya")).toHaveValue("");
      const childView: SessionView = await (
        await page.request.get(`/api/sessions/${id}?branch=${child}`)
      ).json();
      const parent: SessionView = await (
        await page.request.get(`/api/sessions/${id}?branch=${root}`)
      ).json();
      expect(parent.messages).toEqual(original.messages);
      expect(parent.events).toEqual(original.events);
      expect(parent.state).toEqual(original.state);
      await page.getByRole("link", { name: "Compare paths" }).click();
      await expect(
        page.getByRole("heading", { name: "What changed at each turn" }),
      ).toBeVisible();
      // Navigation, reload and evidence inspection must not make a new generation request.
      const beforeReplay = generatedRequests;
      await expect(
        page.getByText("These paths have different numbers of decisions.", {
          exact: false,
        }),
      ).toBeVisible();
      const row2 = page.getByRole("region", {
        name: "Recorded changes at turn 2",
      });
      const row3 = page.getByRole("region", {
        name: "Recorded changes at turn 3",
      });
      await expect(row3).toContainText("No decision recorded at this turn.");
      await expect(row3.locator(".recorded-change").first()).toContainText(
        "Guarantee phrase flagged",
      );
      const deltas = [original, childView].map(
        (view) => view.snapshots[2].state.trust - view.snapshots[1].state.trust,
      );
      for (const [index, delta] of deltas.entries()) {
        await expect(
          row2
            .locator(".recorded-change")
            .nth(index)
            .locator(".change-values > div")
            .first()
            .locator("dd"),
        ).toHaveText(delta > 0 ? `+${delta}` : String(delta));
      }
      const left = page.locator(".compare-column").first();
      await expect(
        left.getByText("From shared history", { exact: true }),
      ).toHaveCount(1);
      await expect(
        left.getByText("After the split", { exact: true }),
      ).toHaveCount(1);
      await left.getByRole("link", { name: "View evidence · turn 1" }).click();
      await expect(
        page.locator(`#shared-${original.findings[0].messageId}`),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /3 shared messages/ }),
      ).toHaveAttribute("aria-expanded", "true");
      await left.getByRole("link", { name: "View evidence · turn 3" }).click();
      await expect(
        page.locator(`#compare-0-${original.findings[1].messageId}`),
      ).toBeVisible();
      await row2
        .locator(".recorded-change")
        .last()
        .getByRole("link", { name: "View response · turn 2" })
        .click();
      await expect(
        page.locator(
          `#compare-1-${childView.messages.find((m) => m.role === "user" && m.turn === 2)!.id}`,
        ),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Clarify the exclusions" }),
      ).toBeVisible();
      await expect(row2).toBeVisible();
      expect(generatedRequests).toBe(beforeReplay);
      const audit = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(audit.violations.map(({ id }) => id)).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      await mkdir("docs/screenshots/phase-4", { recursive: true });
      await page.screenshot({
        path: `docs/screenshots/phase-4/comparison-${size.name}.png`,
        fullPage: true,
        animations: "disabled",
      });
      await page
        .locator(".compare-column")
        .last()
        .getByRole("link", { name: "Continue this path" })
        .click();
      await expect(page.getByLabel("Current approach")).toHaveValue(child);
      await expect(page.getByRole("log")).toContainText(draft);
      await page.getByLabel("Current approach").selectOption(root);
      await expect(page.getByRole("log")).toContainText(prompts[2]);
      await expect(page.getByRole("log")).not.toContainText(draft);
      expect(generatedRequests).toBe(beforeReplay);
      await mkdir("docs/verification/phase-4", { recursive: true });
      await writeFile(
        `docs/verification/phase-4/${size.name}.json`,
        `${JSON.stringify(
          {
            verifiedAt: new Date().toISOString(),
            status: "passed",
            provider: "mock",
            viewport: size,
            checks: {
              nonzeroFork: true,
              prefixPreserved: true,
              parentUnchanged: true,
              savedDeltasMatch: true,
              unequalLengthExplicit: true,
              sharedAndDivergentEvidenceLinks: true,
              reloadAndSwitchWithoutGeneration: true,
              noHorizontalOverflow: true,
              selectedAxeRules: true,
            },
            sharedMessages: 3,
            comparedTurns: [2, 3],
            turn2TrustChanges: deltas,
            cleanup: "The test deletes only its own session in finally.",
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

test("comparison handles no alternative, identical selectors and invalid branch access honestly", async ({
  page,
}) => {
  const created = await page.request.post("/api/sessions", {
    headers,
    data: {},
  });
  const { sessionId: id, branchId: root } = await created.json();
  try {
    await page.goto(`/sessions/${id}/compare`);
    await expect(page.locator(".error-banner[role=alert]")).toContainText(
      "Create an alternative path",
    );
    const original: SessionView = await (
      await page.request.get(`/api/sessions/${id}`)
    ).json();
    const fork = await page.request.post(`/api/branches/${root}/forks`, {
      headers,
      data: { snapshotId: original.snapshots[0].id, name: "Empty alternative" },
    });
    expect(fork.status()).toBe(200);
    await page.goto(`/sessions/${id}/compare?left=${root}&right=${root}`);
    await expect(
      page.getByText("Both selectors currently show the same approach.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("No different decisions have been recorded yet."),
    ).toBeVisible();
    await expect(
      page.getByText("This path is ready for a new response."),
    ).toHaveCount(2);
    const ids = await page
      .locator("[id]")
      .evaluateAll((nodes) => nodes.map((n) => n.id));
    expect(new Set(ids).size).toBe(ids.length);
    await page.goto(
      `/sessions/${id}/compare?left=${root}&right=not-a-session-branch`,
    );
    await expect(page.locator(".error-banner[role=alert]")).toContainText(
      "Branch not found in this session",
    );
    await expect(page.locator(".compare-column")).toHaveCount(0);
  } finally {
    expect(
      (await page.request.delete(`/api/sessions/${id}`, { headers })).status(),
    ).toBe(200);
  }
});
