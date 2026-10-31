import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import type { SessionView } from "../../src/lib/client";
const headers = { origin: "http://127.0.0.1:3101" };
const test = base.extend<{ practice: { id: string; branch: string } }>({
  practice: async ({ page }, provide) => {
    const created = await page.request.post("/api/sessions", {
      headers,
      data: {},
    });
    expect(created.status()).toBe(200);
    const { sessionId: id, branchId: branch } = await created.json();
    try {
      await provide({ id, branch });
    } finally {
      expect(
        (
          await page.request.delete(`/api/sessions/${id}`, { headers })
        ).status(),
      ).toBe(200);
    }
  },
});
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function audit(page: Page) {
  await page
    .locator(".drawer-content")
    .evaluateAll((nodes) =>
      Promise.all(
        nodes.flatMap((node) => node.getAnimations().map((a) => a.finished)),
      ),
    );
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
}
async function capture(page: Page, name: string) {
  const directory =
    process.env.PERSONA_ACCEPTANCE_REVIEW === "1"
      ? `docs/screenshots/phase-6-followup/${test.info().project.name}`
      : "docs/screenshots/phase-6";
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: `${directory}/${name}.png`,
    fullPage: true,
    animations: "disabled",
  });
}
async function record(name: string, data: unknown) {
  const directory =
    process.env.PERSONA_ACCEPTANCE_REVIEW === "1"
      ? `docs/verification/phase-6-followup/${test.info().project.name}`
      : "docs/verification/phase-6";
  await mkdir(directory, { recursive: true });
  await writeFile(
    `${directory}/${name}.json`,
    `${JSON.stringify({ verifiedAt: new Date().toISOString(), provider: "mock", data }, null, 2)}\n`,
  );
}

test("portrait-led studio reflows from desktop through tablet to 320 CSS pixels", async ({
  page,
}) => {
  const sizes = [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
    { name: "reflow-320", width: 320, height: 800 },
  ];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Better conversations/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Meet Priya." }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page
        .getByRole("img", { name: "Priya, a fictional customer in an office" })
        .evaluate((img) => (img as HTMLImageElement).naturalWidth > 0),
    ).toBe(true);
    await noOverflow(page);
    await audit(page);
    await capture(page, `studio-${size.name}`);
  }
  await record("studio-reflow", {
    sizes,
    noOverflow: true,
    portraitLoaded: true,
    selectedAxeRulesPassed: true,
  });
});

test("keyboard rehearsal: guarantee, evidence, rewind, alternative and comparison", async ({
  page,
  browserName,
}) => {
  // macOS WebKit uses Option-Tab for links unless full keyboard access is enabled.
  const tab =
    browserName === "webkit" && process.platform === "darwin"
      ? "Alt+Tab"
      : "Tab";
  const startedAt = Date.now();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/sessions" &&
        response.request().method() === "GET",
    ),
    page.goto("/"),
  ]);
  await expect(
    page.getByRole("heading", { name: /Better conversations/ }),
  ).toBeVisible();
  await page.keyboard.press(tab);
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  const begin = page.getByRole("button", {
    name: "Begin practice",
    exact: true,
  });
  await begin.focus();
  await page.keyboard.press(tab);
  const brief = page.getByRole("button", { name: "Read the brief" });
  await expect(brief).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Close panel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(brief).toBeFocused();
  await begin.focus();
  await page.keyboard.press("Enter");
  // Practice entry creates a new document to apply its microphone policy.
  await expect(page).toHaveURL(/\/sessions\/[^/?]+$/);
  const id = new URL(page.url()).pathname.split("/")[2];
  try {
    const input = page.getByLabel("Your response to Priya");
    await expect(input).toBeVisible();
    await expect(page.getByRole("log")).toHaveAttribute("aria-live", "polite");
    for (const text of ["All claims are guaranteed.", "What is your budget?"]) {
      await input.fill(text);
      await input.press("Enter");
      await expect(input).toHaveValue("");
    }
    await capture(page, "practice-desktop");
    const notes = page.getByRole("button", {
      name: /Field notes · Evaluation/,
    });
    await notes.focus();
    await notes.press("Enter");
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Refresh report card" })
      .press("Enter");
    await expect(
      dialog.getByText("Strengths with evidence", { exact: true }),
    ).toBeVisible();
    await audit(page);
    await capture(page, "evaluation-desktop");
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press(tab);
      expect(
        await page.evaluate(() =>
          Boolean(document.activeElement?.closest('[role="dialog"]')),
        ),
      ).toBe(true);
    }
    const link = dialog.locator(".evaluation-evidence a").first();
    const target = (await link.getAttribute("href"))!;
    await link.focus();
    await link.press("Enter");
    await expect(dialog).not.toBeVisible();
    await expect(page.locator(target)).toBeFocused();
    const rewind = page
      .getByRole("button", { name: "Try another response" })
      .first();
    await rewind.focus();
    await rewind.press("Enter");
    await page.getByLabel("Name this approach").fill("Explain the limits");
    await page
      .getByRole("button", { name: "Create alternative path" })
      .press("Enter");
    await expect(page).toHaveURL(/branch=/);
    await input.fill(
      "Claims are reviewed, not guaranteed. A 30-day waiting period applies.",
    );
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await page.getByRole("link", { name: "Compare paths" }).press("Enter");
    await expect(
      page.getByRole("heading", { name: "See what changes." }),
    ).toBeVisible();
    await audit(page);
    await capture(page, "comparison-desktop");
    await record("keyboard-rehearsal", {
      elapsedMs: Date.now() - startedAt,
      keyboardActivation: true,
      skipLink: true,
      dialogFocusContained: true,
      evidenceReceivesFocus: true,
      rewindAndComparison: true,
      selectedAxeRulesPassed: true,
      automatedTimingOnly: true,
      tabKey: tab,
    });
  } finally {
    expect(
      (await page.request.delete(`/api/sessions/${id}`, { headers })).status(),
    ).toBe(200);
  }
});

test("practice, branching and report reflow at 320px and larger text", async ({
  page,
  practice,
}) => {
  await page.request.post(`/api/branches/${practice.branch}/turns`, {
    headers,
    data: {
      text: "All claims are guaranteed.",
      revision: 0,
      key: crypto.randomUUID(),
    },
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/sessions/${practice.id}`);
  await expect(page.getByRole("log")).toContainText(
    "All claims are guaranteed.",
  );
  await noOverflow(page);
  await audit(page);
  await capture(page, "practice-reflow-320");
  const rewind = page.getByRole("button", { name: "Try another response" });
  await rewind.click();
  expect(
    await page
      .locator(".drawer-content")
      .evaluate((node) => parseFloat(getComputedStyle(node).animationDuration)),
  ).toBeLessThanOrEqual(0.00001);
  await noOverflow(page);
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(rewind).toBeFocused();
  await page.getByRole("button", { name: /Field notes/ }).click();
  await page.getByRole("button", { name: "Refresh report card" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Strengths with evidence", { exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  await audit(page);
  await capture(page, "evaluation-reflow-320");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });
  // Text-only resize stress test: double readable body/control text, without changing icons or layout widths.
  await page.addStyleTag({
    content:
      ".message-bubble, .button, textarea, .practice-heading p, .branch-select select {font-size: 24px !important;}",
  });
  await noOverflow(page);
  await expect(page.getByLabel("Your response to Priya")).toBeVisible();
  await capture(page, "practice-larger-text");
  await record("reflow-and-text", {
    width: 320,
    reducedMotion: true,
    focusRestored: true,
    selectedAxeRulesPassed: true,
    textResize: "24px body/control stress test; not native browser zoom",
    noOverflow: true,
  });
});

test("provider failure announces progress, keeps a draft on reload and retries without partial writes", async ({
  page,
  practice,
}) => {
  await page.goto(`/sessions/${practice.id}`);
  await expect(page.getByRole("log")).toContainText(
    "I've looked at a few policies",
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    `**/api/branches/${practice.branch}/turns`,
    async (route) => {
      await gate;
      await route.fulfill({
        status: 502,
        json: { error: "The character could not respond. No turn was saved." },
      });
    },
  );
  const draft = "Could we review the exclusions?";
  await page.getByLabel("Your response to Priya").fill(draft);
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Preparing Priya's response" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your response to Priya")).toHaveJSProperty(
    "readOnly",
    true,
  );
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "No turn was saved" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your response to Priya")).toHaveValue(draft);
  await page.reload();
  await expect(page.getByLabel("Your response to Priya")).toHaveValue(draft);
  const before: SessionView = await (
    await page.request.get(`/api/sessions/${practice.id}`)
  ).json();
  expect(before.branch.revision).toBe(0);
  expect(before.messages).toHaveLength(1);
  await page.unroute(`**/api/branches/${practice.branch}/turns`);
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByLabel("Your response to Priya")).toHaveValue("");
  const after: SessionView = await (
    await page.request.get(`/api/sessions/${practice.id}`)
  ).json();
  expect(after.branch.revision).toBe(1);
  expect(after.messages).toHaveLength(3);
  await record("draft-retry", {
    progressStatus: true,
    draftSurvivesReload: true,
    noPartialTurn: true,
    retryCommittedExactlyOnce: true,
  });
});

test("expired and temporarily unavailable conversations have clear recovery actions", async ({
  page,
  practice,
}) => {
  await page.route(`**/api/sessions/${practice.id}`, (route) =>
    route.fulfill({
      status: 404,
      json: { error: "Session not found or expired." },
    }),
  );
  await page.goto(`/sessions/${practice.id}`);
  await expect(
    page.getByRole("alert").filter({ hasText: "expired" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Return to scenario studio" }),
  ).toHaveAttribute("href", "/");
  await page.unroute(`**/api/sessions/${practice.id}`);
  let unavailable = true;
  await page.route(`**/api/sessions/${practice.id}`, (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          json: { error: "Temporary database connection issue" },
        })
      : route.continue(),
  );
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "database connection" }),
  ).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("log")).toContainText(
    "I've looked at a few policies",
  );
  await page.unroute(`**/api/sessions/${practice.id}`);
  await record("recovery", {
    expiredRecoveryLink: true,
    temporaryReadFailure: true,
    retryRestoresHistory: true,
    errorsInjectedAtBrowserBoundary: true,
  });
});

test("forced colors keeps the portrait captions and keyboard focus legible", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  expect(
    await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
  await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === "/api/sessions"),
    page.goto("/"),
  ]);
  const begin = page.getByRole("button", {
    name: "Begin practice",
    exact: true,
  });
  await begin.focus();
  await expect(begin).toBeFocused();
  const colors = await page
    .locator(".hero-persona-caption")
    .evaluate((node) => ({
      color: getComputedStyle(node).color,
      background: getComputedStyle(node).backgroundColor,
    }));
  expect(colors.color).not.toBe(colors.background);
  expect(
    await begin.evaluate((node) => getComputedStyle(node).outlineWidth),
  ).toBe("2px");
  await noOverflow(page);
  await capture(page, "studio-forced-colors");
  await record("forced-colors", {
    systemColors: true,
    captionContrast: true,
    keyboardFocusOutline: true,
    noOverflow: true,
  });
});
