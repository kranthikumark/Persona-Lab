import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { localizedContent } from "../../src/lib/localization/content";
const headers = { origin: "http://127.0.0.1:3101" };
for (const locale of ["hi-IN", "te-IN"] as const)
  for (const width of [1440, 390])
    test(`${locale} ${width}px: native script, IME, reload, original evidence, independent comparison`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      const selector = page.getByRole("combobox", {
        name: "Practice & character",
        exact: true,
      });
      await expect(selector.locator(`option[value="${locale}"]`)).toBeEnabled();
      await selector.selectOption(locale);
      await expect(
        page.getByText("Your next conversation:", { exact: false }),
      ).toContainText(locale === "hi-IN" ? "हिन्दी" : "తెలుగు");
      await page
        .getByRole("button", { name: "Begin practice", exact: true })
        .click();
      await expect(page).toHaveURL(/\/sessions\//);
      const sessionId = page.url().split("/sessions/")[1];
      try {
        const initial = await (
          await page.request.get(`/api/sessions/${sessionId}`)
        ).json();
        expect(initial.settings.practiceLocale).toBe(locale);
        await expect(page.getByRole("log")).toContainText(
          localizedContent[locale].opening,
        );
        const input = page.getByRole("textbox", {
          name: localizedContent[locale].labels.response,
        });
        const typingHelp = page.locator(".typing-help");
        await typingHelp.locator("summary").click();
        await expect(typingHelp).toContainText(
          locale === "hi-IN"
            ? "Hindi transliteration"
            : "Telugu transliteration",
        );
        await expect(typingHelp.getByRole("link").first()).toHaveAttribute(
          "href",
          "https://chromewebstore.google.com/detail/google-input-tools/mclkkofklkfljcocdinagocijmpgbhab",
        );
        await expect(typingHelp.getByRole("link").last()).toHaveAttribute(
          "href",
          "https://www.google.com/inputtools/try/",
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await typingHelp.locator("summary").click();
        await input.fill(localizedContent[locale].samples[0]);
        await input.dispatchEvent("compositionstart");
        await input.press("Enter");
        await expect(
          page.getByRole("button", {
            name: localizedContent[locale].labels.send,
            exact: true,
          }),
        ).toBeDisabled();
        expect(
          (await (await page.request.get(`/api/sessions/${sessionId}`)).json())
            .branch.revision,
        ).toBe(0);
        await input.dispatchEvent("compositionend");
        const originalDraft = await input.inputValue();
        await page
          .getByRole("button", {
            name: localizedContent[locale].labels.send,
            exact: true,
          })
          .click();
        await expect(input).toHaveValue("");
        for (let i = 1; i < 5; i++)
          expect(
            (
              await page.request.post(
                `/api/branches/${initial.branch.id}/turns`,
                {
                  headers,
                  data: {
                    text: localizedContent[locale].samples[i],
                    revision: i,
                    key: crypto.randomUUID(),
                  },
                },
              )
            ).ok(),
          ).toBe(true);
        await page.reload();
        await expect(page.getByRole("log")).toContainText(
          localizedContent[locale].samples[4],
        );
        const font =
          locale === "hi-IN" ? "Noto Sans Devanagari" : "Noto Sans Telugu";
        expect(
          await page.evaluate(
            async ({ font, sample }) => {
              await document.fonts.load(`16px "${font}"`, sample);
              return document.fonts.check(`16px "${font}"`, sample);
            },
            { font, sample: localizedContent[locale].opening },
          ),
        ).toBe(true);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const saved = await (
          await page.request.get(`/api/sessions/${sessionId}`)
        ).json();
        expect(saved.state.phase).toBe("next_step");
        await mkdir("docs/screenshots/v5-05", { recursive: true });
        await page.locator(".conversation-panel").screenshot({
          path: `docs/screenshots/v5-05/conversation-${locale}-${width}.png`,
        });
        expect(saved.messages[1].content).toBe(originalDraft);
        await page.getByRole("button", { name: /Field notes/ }).click();
        const dialog = page.getByRole("dialog");
        await expect(
          dialog.getByText(/explicit English fallback/),
        ).toBeVisible();
        await expect(
          dialog.getByRole("button", { name: "Download PDF", exact: true }),
        ).toBeEnabled();
        const evaluated = await (
          await page.request.get(
            `/api/branches/${initial.branch.id}/evaluation`,
          )
        ).json();
        expect(evaluated.report.analysisLocale).toBe(locale);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.keyboard.press("Escape");
        const fork = await (
          await page.request.post(`/api/branches/${initial.branch.id}/forks`, {
            headers,
            data: {
              snapshotId: initial.snapshots[0].id,
              name: "Native alternative",
            },
          })
        ).json();
        expect(
          (
            await page.request.post(`/api/branches/${fork.branchId}/turns`, {
              headers,
              data: {
                text: localizedContent[locale].samples[1],
                revision: 0,
                key: crypto.randomUUID(),
              },
            })
          ).ok(),
        ).toBe(true);
        await page.goto(
          `/sessions/${sessionId}/compare?left=${initial.branch.id}&right=${fork.branchId}`,
        );
        await expect(page.locator(".compare-column").first()).toContainText(
          localizedContent[locale].samples[0],
        );
        const parent = await (
          await page.request.get(`/api/sessions/${sessionId}`)
        ).json();
        for (const field of ["messages", "events", "snapshots", "state"])
          expect(parent[field]).toEqual(saved[field]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await mkdir("docs/screenshots/v5-05", { recursive: true });
        await page.screenshot({
          path: `docs/screenshots/v5-05/${locale}-${width}.png`,
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
