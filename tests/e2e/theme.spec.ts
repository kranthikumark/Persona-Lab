import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const headers = { origin: "http://127.0.0.1:3101" };
async function audit(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("light theme persists through navigation and reload, reflows, and switches back with keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Light theme", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(16, 18, 24)",
  );
  await toggle.focus();
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(246, 245, 250)",
  );
  await audit(page);
  await page.screenshot({
    path: "/tmp/persona-theme-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Practice history", exact: true })
    .click();
  await expect(page).toHaveTitle("Practice history · PERSONA LAB");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await audit(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Read the brief" }).click();
  await audit(page);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(toggle).toBeVisible();
  await audit(page);
  await page.screenshot({
    path: "/tmp/persona-theme-mobile.png",
    fullPage: true,
  });
  await toggle.focus();
  await toggle.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(16, 18, 24)",
  );
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("light theme covers conversation, branch dialog, evaluation and comparison", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("persona-lab-theme", "light"),
  );
  const response = await page.request.post("/api/sessions", {
    headers,
    data: {},
  });
  expect(response.ok()).toBe(true);
  const { sessionId } = await response.json();
  try {
    await page.goto(`/sessions/${sessionId}`);
    const input = page.getByLabel("Your response to Priya");
    await input.fill("All claims are guaranteed.");
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await audit(page);
    await page.screenshot({
      path: "/tmp/persona-theme-practice.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: /Field notes/ }).click();
    await page.getByRole("button", { name: "Refresh report card" }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByText("Strengths with evidence", { exact: true }),
    ).toBeVisible();
    await audit(page);
    await page.screenshot({
      path: "/tmp/persona-theme-evaluation.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Try another response" })
      .first()
      .click();
    await audit(page);
    await page.getByLabel("Name this approach").fill("Explain the limits");
    await page.getByRole("button", { name: "Create alternative path" }).click();
    await expect(page).toHaveURL(/branch=/);
    await input.fill(
      "Claims are reviewed, not guaranteed. Let's review exclusions and waiting periods.",
    );
    await input.press("Enter");
    await expect(input).toHaveValue("");
    await page.getByRole("link", { name: "Compare paths" }).click();
    await expect(
      page.getByRole("heading", { name: "See what changes." }),
    ).toBeVisible();
    await audit(page);
    await page.setViewportSize({ width: 320, height: 800 });
    await audit(page);
  } finally {
    expect(
      (
        await page.request.delete(`/api/sessions/${sessionId}`, { headers })
      ).ok(),
    ).toBe(true);
  }
});

test("theme switching works when storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value: () => {
        throw new Error("Blocked");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new Error("Blocked");
      },
    });
  });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Light theme", exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});
