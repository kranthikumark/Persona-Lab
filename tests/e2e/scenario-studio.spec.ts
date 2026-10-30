import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const headers = { origin: "http://127.0.0.1:3101" };
for (const theme of ["dark", "light"] as const)
  test(`${theme}: library filtering and private studio survive reload on desktop and phone`, async ({
    page,
    browser,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("persona-lab-theme", theme),
      theme,
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "The practice library" }),
    ).toBeVisible();
    await expect(page.locator(".catalog-card").first()).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/v5-07/library-${theme}-desktop.png`,
      fullPage: true,
    });
    await page.getByLabel("Edition", { exact: true }).selectOption("PERSONAL");
    await expect(
      page.getByText("Personal practice is on its way."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page.locator(".catalog-card").first()).toBeVisible();
    await page
      .getByLabel("Difficulty", { exact: true })
      .selectOption("advanced");
    await expect(page.getByText("No matching scenarios yet.")).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await page.getByRole("link", { name: "Create a text draft" }).click();
    await expect(
      page.getByRole("heading", { name: "Make room for a new brief." }),
    ).toBeVisible();
    await page.getByRole("button", { name: "New draft", exact: true }).click();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "My trust conversation",
    );
    const listing = await (
      await page.request.get("/api/catalog/drafts")
    ).json();
    const draft = listing.drafts[0];
    try {
      await page
        .getByLabel("Title", { exact: true })
        .fill(`Private ${theme} acceptance draft`);
      await page.getByRole("button", { name: "Save revision" }).click();
      await expect(page.getByRole("status")).toContainText("Saved privately");
      await page.reload();
      await page
        .getByRole("button", {
          name: new RegExp(`Private ${theme} acceptance draft`),
        })
        .click();
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
        `Private ${theme} acceptance draft`,
      );
      const foreign = await browser.newContext();
      try {
        expect(
          (
            await (
              await foreign.request.get(
                "http://127.0.0.1:3101/api/catalog/drafts",
              )
            ).json()
          ).drafts,
        ).toEqual([]);
        expect(
          (
            await foreign.request.patch(
              `http://127.0.0.1:3101/api/catalog/drafts/${draft.id}`,
              { headers, data: { revision: 2, content: draft.content } },
            )
          ).status(),
        ).toBe(404);
      } finally {
        await foreign.close();
      }
      expect(
        (
          await page.request.patch(`/api/catalog/drafts/${draft.id}`, {
            headers,
            data: { revision: 1, content: draft.content },
          })
        ).status(),
      ).toBe(409);
      expect(
        (
          await page.request.patch(`/api/catalog/drafts/${draft.id}`, {
            headers,
            data: { revision: 2, content: draft.content, role: "operator" },
          })
        ).status(),
      ).toBe(400);
      expect(
        (
          await page.request.post(`/api/catalog/drafts/${draft.id}/publish`, {
            headers,
            data: { role: "operator" },
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await page.request.patch(`/api/catalog/drafts/${draft.id}`, {
            headers: { origin: "https://foreign.invalid" },
            data: { revision: 2, content: draft.content },
          })
        ).status(),
      ).toBe(403);
      await page
        .getByText("Verified foundation · fixed for this template", {
          exact: true,
        })
        .click();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (width === 390)
          await page.screenshot({
            path: `docs/screenshots/v5-07/creator-${theme}-phone.png`,
            fullPage: true,
          });
      }
    } finally {
      await page.request.delete(`/api/catalog/drafts/${draft.id}`, { headers });
    }
  });
test("catalog practice starts the explicit selected version and hides private knowledge", async ({
  page,
}) => {
  const catalog = await (await page.request.get("/api/catalog")).json();
  expect(JSON.stringify(catalog)).not.toContain("budgetConcern");
  expect(JSON.stringify(catalog)).not.toContain("previousExperience");
  await page.goto("/");
  await page
    .locator(".catalog-card")
    .first()
    .getByRole("button", { name: "Begin this practice" })
    .click();
  await expect(page).toHaveURL(/\/sessions\//);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  try {
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      catalog.scenarios[0].title,
    );
  } finally {
    await page.request.delete(`/api/sessions/${id}`, { headers });
  }
});
