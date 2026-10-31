import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { encodeWav } from "../../src/lib/speech/wav";
const headers = { origin: "http://127.0.0.1:3101" };
const wav = Buffer.from(
  encodeWav(
    Float32Array.from({ length: 24000 }, (_, i) => Math.sin(i / 10) * 0.1),
    24000,
  ),
);
for (const theme of ["dark", "light"] as const) {
  test(`${theme}: private media review survives reload, stays private, reflows and erases all retained content`, async ({
    page,
    browser,
  }) => {
    await page.addInitScript(
      (theme) => localStorage.setItem("persona-lab-theme", theme),
      theme,
    );
    await page.goto("/create");
    await page.getByRole("button", { name: "New draft", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Bring a conversation to the brief." }),
    ).toBeVisible();
    const draft = (await (await page.request.get("/api/catalog/drafts")).json())
      .drafts[0];
    try {
      const save = page.getByRole("button", {
        name: "Save private source",
        exact: true,
      });
      await expect(save).toBeDisabled();
      await page.getByLabel("Source recording", { exact: true }).setInputFiles({
        name: "reference.wav",
        mimeType: "audio/wav",
        buffer: wav,
      });
      await page
        .getByLabel("I have permission to upload and use this recording.", {
          exact: true,
        })
        .check();
      await expect(save).toBeDisabled();
      await page
        .getByLabel(
          "Store this source and its transcripts privately for the selected period. I can delete them sooner.",
          { exact: true },
        )
        .check();
      await save.click();
      await expect(page.locator(".source-card h4")).toHaveText("reference.wav");
      const source = (
        await (
          await page.request.get(`/api/catalog/drafts/${draft.id}/sources`)
        ).json()
      ).sources[0];
      const file = `/api/catalog/drafts/${draft.id}/sources/${source.id}/file`;
      const ranged = await page.request.get(file, {
        headers: { range: "bytes=0-15" },
      });
      expect(ranged.status()).toBe(206);
      expect(ranged.headers()["cache-control"]).toContain("private");
      expect((await ranged.body()).length).toBe(16);
      const foreign = await browser.newContext();
      try {
        expect(
          (await foreign.request.get(`http://127.0.0.1:3101${file}`)).status(),
        ).toBe(404);
        expect(
          (
            await foreign.request.get(
              `http://127.0.0.1:3101/api/catalog/drafts/${draft.id}/sources`,
            )
          ).status(),
        ).toBe(404);
      } finally {
        await foreign.close();
      }
      expect(
        (await page.request.get(`/.private-media/${source.id}.media`)).status(),
      ).toBe(404);
      const transcript = page.getByLabel("Transcript", { exact: true });
      await transcript.fill(
        "Ask about exclusions and the customer's budget before making a recommendation.",
      );
      const attach = page.getByRole("button", {
        name: "Review & attach source",
        exact: true,
      });
      await expect(attach).toBeDisabled();
      await page
        .getByLabel(
          "I reviewed this transcript and any translation for accuracy.",
          { exact: true },
        )
        .check();
      await attach.click();
      await expect(page.locator(".source-status")).toHaveText(
        "Reviewed · attached",
      );
      const stored = await (
        await page.request.get(`/api/catalog/drafts/${draft.id}`)
      ).json();
      expect(stored.content.sources).toHaveLength(1);
      const revised =
        "Ask about exclusions and the customer's budget before making a recommendation. Use plain language.";
      await page.locator(".source-review textarea").first().fill(revised);
      await page
        .getByLabel(
          "I reviewed this transcript and any translation for accuracy.",
          { exact: true },
        )
        .check();
      await attach.click();
      await expect(
        page.getByText("Transcript history · 2 versions", { exact: true }),
      ).toBeVisible();
      await page
        .getByText("Transcript history · 2 versions", { exact: true })
        .click();
      await expect(
        page
          .locator(".source-history")
          .getByText(
            "Ask about exclusions and the customer's budget before making a recommendation.",
            { exact: true },
          ),
      ).toBeVisible();
      await page.reload();
      await page
        .getByRole("button", { name: /My trust conversation.*Revision/ })
        .click();
      await expect(page.locator(".source-status")).toHaveText(
        "Reviewed · attached",
      );
      await expect(page.getByLabel(/Transcript/)).toHaveValue(revised);
      await page.screenshot({
        path: `docs/screenshots/v5-10/sources-${theme}-1440.png`,
        fullPage: true,
      });
      const violations = (await new AxeBuilder({ page }).analyze()).violations;
      expect(violations).toEqual([]);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `docs/screenshots/v5-10/sources-${theme}-390.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.setViewportSize({ width: 320, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      page.once("dialog", (dialog) => dialog.accept());
      await page
        .getByRole("button", { name: "Delete source", exact: true })
        .click();
      await expect(page.locator(".source-card")).toHaveCount(0);
      expect((await page.request.get(file)).status()).toBe(404);
    } finally {
      await page.request.delete(`/api/catalog/drafts/${draft.id}`, { headers });
    }
  });
}
test("foreign origins, missing retention permission and fake files do not become usable sources", async ({
  page,
}) => {
  await page.goto("/create");
  await page.getByRole("button", { name: "New draft", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "My trust conversation",
  );
  const draft = (await (await page.request.get("/api/catalog/drafts")).json())
      .drafts[0],
    base = `/api/catalog/drafts/${draft.id}/sources`;
  const meta = {
    draftRevision: draft.revision,
    name: "reference.wav",
    bytes: wav.length,
    locale: "en-IN",
    retentionDays: 1,
    rights: true,
    retention: true,
  };
  try {
    const h = {
      ...headers,
      "content-type": "audio/wav",
      "x-source-meta": encodeURIComponent(JSON.stringify(meta)),
    };
    expect(
      (
        await page.request.post(base, {
          headers: { ...h, origin: "https://foreign.example.test" },
          data: wav,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await page.request.post(base, {
          headers: {
            ...h,
            "x-source-meta": encodeURIComponent(
              JSON.stringify({ ...meta, retention: false }),
            ),
          },
          data: wav,
        })
      ).status(),
    ).toBe(400);
    const fake = Buffer.from("<html>not audio</html>");
    expect(
      (
        await page.request.post(base, {
          headers: {
            ...h,
            "x-source-meta": encodeURIComponent(
              JSON.stringify({ ...meta, bytes: fake.length }),
            ),
          },
          data: fake,
        })
      ).status(),
    ).toBe(422);
    expect((await (await page.request.get(base)).json()).sources).toHaveLength(
      0,
    );
  } finally {
    await page.request.delete(`/api/catalog/drafts/${draft.id}`, { headers });
  }
});
