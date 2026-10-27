import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

type PracticeFixture = {
  id: string;
  original: string;
  alternative: string;
  spare: string;
};
const test = base.extend<{ practice: PracticeFixture }>({
  practice: async ({ page }, provide) => {
    const headers = { origin: "http://127.0.0.1:3101" };
    const create = await page.request.post("/api/sessions", {
      headers,
      data: {},
    });
    expect(create.ok()).toBe(true);
    const { sessionId: id, branchId: original } = await create.json();
    try {
      const first = await page.request.post(`/api/branches/${original}/turns`, {
        headers,
        data: {
          text: "What is your budget?",
          key: crypto.randomUUID(),
          revision: 0,
        },
      });
      expect(first.ok()).toBe(true);
      const saved = await first.json();
      const second = await page.request.post(
        `/api/branches/${original}/turns`,
        {
          headers,
          data: {
            text: "All claims are guaranteed.",
            key: crypto.randomUUID(),
            revision: 1,
          },
        },
      );
      expect(second.ok()).toBe(true);
      const fork = await page.request.post(`/api/branches/${original}/forks`, {
        headers,
        data: {
          snapshotId: saved.snapshots.at(-1).id,
          name: "Explain the limits",
        },
      });
      expect(fork.ok()).toBe(true);
      const { branchId: alternative } = await fork.json();
      const child = await page.request.post(
        `/api/branches/${alternative}/turns`,
        {
          headers,
          data: {
            text: "Claims are reviewed, not guaranteed. Let's review the exclusions.",
            key: crypto.randomUUID(),
            revision: 0,
          },
        },
      );
      expect(child.ok()).toBe(true);
      const extra = await page.request.post(`/api/branches/${original}/forks`, {
        headers,
        data: {
          snapshotId: saved.snapshots[0].id,
          name: "Discover the concern",
        },
      });
      expect(extra.ok()).toBe(true);
      const { branchId: spare } = await extra.json();
      await provide({ id, original, alternative, spare });
    } finally {
      expect(
        (await page.request.delete(`/api/sessions/${id}`, { headers })).ok(),
      ).toBe(true);
    }
  },
});

async function audit(page: Page) {
  await page
    .locator(".drawer-content")
    .evaluateAll((nodes) =>
      Promise.all(
        nodes.flatMap((node) =>
          node.getAnimations().map((animation) => animation.finished),
        ),
      ),
    );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect
    .soft(
      result.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({
          target,
          failureSummary,
        })),
      })),
    )
    .toEqual([]);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function screenshot(page: Page, name: string) {
  await mkdir("docs/screenshots/phase-1", { recursive: true });
  await page.screenshot({
    path: `docs/screenshots/phase-1/${name}.png`,
    fullPage: true,
  });
}

test("desktop visual system: all three screens and policy drawer pass automated accessibility checks", async ({
  page,
  practice,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Better conversations/ }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await audit(page);
  await noOverflow(page);
  await screenshot(page, "studio-desktop");
  const brief = page.getByRole("button", { name: "Read the brief" });
  await brief.focus();
  await brief.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Close panel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Close panel" })).toBeFocused();
  await audit(page);
  await page.keyboard.press("Escape");
  await expect(brief).toBeFocused();
  await page.goto(`/sessions/${practice.id}`);
  await expect(page.getByRole("log")).toContainText(
    "All claims are guaranteed.",
  );
  await audit(page);
  await noOverflow(page);
  await screenshot(page, "practice-desktop");
  await page
    .getByRole("button", { name: "Try another response" })
    .last()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Create alternative path" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close panel" })).toBeFocused();
  await audit(page);
  await page.keyboard.press("Escape");
  await page.goto(
    `/sessions/${practice.id}/compare?left=${practice.original}&right=${practice.alternative}`,
  );
  await expect(
    page.getByRole("heading", { name: "Explain the limits" }),
  ).toBeVisible();
  await expect(
    page.getByLabel(
      "Both paths share the same recorded history before diverging",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: /shared messages before/ }).click();
  await expect(page.locator("#shared-transcript")).toContainText(
    "What is your budget?",
  );
  await audit(page);
  await noOverflow(page);
  await screenshot(page, "compare-desktop");
  await page.getByLabel("Choose path B").selectOption(practice.spare);
  await expect(
    page.getByRole("heading", { name: "Discover the concern" }),
  ).toBeVisible();
  await expect(
    page.getByText("This path is ready for a new response."),
  ).toBeVisible();
});

test("mobile navigation, expandable context, timeline, comparison and reduced motion", async ({
  page,
  practice,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "PERSONA LAB home" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The trust conversation.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Workspace navigation" }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await noOverflow(page);
  await audit(page);
  await screenshot(page, "studio-mobile");
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("link", { name: "History" })
    .click();
  await expect(
    page.getByRole("link", { name: "History", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Your practice history" }),
  ).toBeVisible();
  await page.goto(`/sessions/${practice.id}`);
  await expect(page.getByRole("log")).toContainText(
    "All claims are guaranteed.",
  );
  const context = page.getByRole("button", { name: "Objectives & state" });
  await expect(context).toHaveAttribute("aria-expanded", "false");
  await context.focus();
  await context.press("Enter");
  await expect(context).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByText("Discover what matters to Priya", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Scenario indicators, not psychological measurements.", {
      exact: true,
    }),
  ).toBeVisible();
  await audit(page);
  await noOverflow(page);
  await screenshot(page, "practice-mobile");
  await page.getByRole("button", { name: /The starting point Priya/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page
      .locator(".drawer-content")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await audit(page);
  await page.keyboard.press("Escape");
  await page.goto(
    `/sessions/${practice.id}/compare?left=${practice.original}&right=${practice.alternative}`,
  );
  await expect(
    page.getByRole("heading", { name: "Explain the limits" }),
  ).toBeVisible();
  const first = await page.locator(".compare-column").first().boundingBox();
  const second = await page.locator(".compare-column").last().boundingBox();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height);
  await expect(page.getByLabel("Choose path B")).toBeEnabled();
  await audit(page);
  await noOverflow(page);
  await screenshot(page, "compare-mobile");
  await page.getByLabel("Choose path B").selectOption(practice.spare);
  await expect(
    page.getByRole("heading", { name: "Discover the concern" }),
  ).toBeVisible();
  await expect(
    page.getByText("This path is ready for a new response."),
  ).toBeVisible();
});

test("honest loading, empty history, recoverable error and keyboard skip link", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/sessions", async (route) => {
    await held;
    await route.fulfill({ json: { sessions: [] } });
  });
  await page.goto("/?view=history");
  await expect(page.getByRole("status")).toHaveText(
    "Loading your saved practice…",
  );
  await expect(
    page.getByText("Your first possibility is waiting."),
  ).toBeHidden();
  release();
  await expect(
    page.getByText("Your first possibility is waiting."),
  ).toBeVisible();
  await page.unroute("**/api/sessions");
  let attempts = 0;
  await page.route("**/api/sessions", (route) =>
    route.fulfill(
      ++attempts === 1
        ? { status: 503, json: { error: "Temporary connection issue" } }
        : { json: { sessions: [] } },
    ),
  );
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: "Temporary connection issue" }),
  ).toHaveText("Temporary connection issue");
  await page.getByRole("button", { name: "Retry history" }).click();
  await expect(
    page.getByText("Your first possibility is waiting."),
  ).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/sessions",
    ),
    page.goto("/"),
  ]);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});
