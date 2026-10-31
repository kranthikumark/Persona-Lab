import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { localizedContent } from "../../src/lib/localization/content";
const headers = { origin: "http://127.0.0.1:3101" };
async function emit(page: Page, event: string, index = -1) {
  await page.evaluate(
    ({ event, index }) => {
      (
        window as unknown as {
          __avatarEvent: (event: string, index: number) => void;
        }
      ).__avatarEvent(event, index);
    },
    { event, index },
  );
}
for (const locale of ["en-IN", "hi-IN", "te-IN"] as const)
  test(`${locale}: photographic stage follows actual speech events, capture and thinking`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["microphone"]);
    await page.addInitScript(() => {
      localStorage.setItem(
        "persona-voice-choice-v1",
        "allow-meta-transcription-no-audio-retention",
      );
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        value: class {
          text: string;
          voice: unknown;
          lang = "";
          rate = 1;
          constructor(text: string) {
            this.text = text;
          }
        },
      });
      const utterances: SpeechSynthesisUtterance[] = [];
      Object.assign(window, {
        __avatarEvent: (event: string, index = -1) => {
          const utterance = utterances.at(index);
          if (utterance)
            (utterance as unknown as Record<string, () => void>)[
              "on" + event
            ]?.();
        },
      });
      const events = new EventTarget();
      Object.defineProperty(window, "speechSynthesis", {
        value: {
          getVoices: () =>
            ["en-IN", "hi-IN", "te-IN"].map((lang) => ({
              name: lang,
              lang,
              localService: true,
            })),
          addEventListener: events.addEventListener.bind(events),
          removeEventListener: events.removeEventListener.bind(events),
          cancel: () => {},
          speak: (u: SpeechSynthesisUtterance) => utterances.push(u),
        },
      });
    });
    await page.goto("/");
    const created = await (
      await page.request.post("/api/sessions", {
        headers,
        data: { practiceLocale: locale },
      })
    ).json();
    try {
      await page.goto(`/sessions/${created.sessionId}`);
      const avatar = page.locator(".priya-avatar");
      const group = page.getByRole("group", { name: "Spoken AI replies" });
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await page
        .getByRole("button", { name: "Auto speak replies off" })
        .click();
      await expect(avatar).toHaveAttribute("data-stage", "preparing");
      expect(
        await avatar
          .locator(".priya-signal i")
          .first()
          .evaluate((e) => getComputedStyle(e).animationName),
      ).toBe("none");
      await emit(page, "start");
      await expect(avatar).toHaveAttribute("data-stage", "speaking");
      await expect(page.locator(".voice-caption p")).toHaveText(
        localizedContent[locale].opening,
      );
      await page.emulateMedia({ reducedMotion: "no-preference" });
      expect(
        await avatar
          .locator(".priya-signal i")
          .first()
          .evaluate((e) => getComputedStyle(e).animationName),
      ).toBe("priya-wave");
      if (locale === "en-IN") {
        for (const theme of ["dark", "light"]) {
          await page.evaluate((theme) => {
            document.documentElement.dataset.theme = theme;
            localStorage.setItem("persona-lab-theme", theme);
          }, theme);
          for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.locator(".character-panel").screenshot({
              path: `docs/screenshots/v5-09/photoreal-${theme}-${width}.png`,
            });
            if (width === 1440)
              await page
                .locator(".practice-grid")
                .screenshot({
                  path: `docs/screenshots/v5-09/photoreal-room-${theme}-1440.png`,
                });
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
          }
          const audit = await new AxeBuilder({ page })
            .include(".character-panel")
            .include(".composer-area")
            .analyze();
          expect(audit.violations).toEqual([]);
        }
      }
      for (const width of [320, 390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await expect(avatar).toHaveAttribute("data-renderer", "portrait");
      await expect(avatar.locator("img")).toBeVisible();
      await expect(avatar.locator("svg.priya-illustration")).toHaveCount(0);
      expect(
        await avatar
          .locator("img")
          .evaluate((e) => getComputedStyle(e).animationName),
      ).toBe("none");
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await avatar
          .locator(".priya-signal i")
          .first()
          .evaluate((e) => getComputedStyle(e).animationName),
      ).toBe("none");
      await expect(avatar.getByRole("status")).toContainText(
        "Priya is speaking",
      );
      await group.getByRole("button", { name: "Stop reply" }).click();
      await emit(page, "start", 0); // Late start from cancelled audio must not animate.
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await expect(page.locator(".voice-caption")).toHaveCount(0);
      await group.getByRole("button", { name: "Replay reply" }).click();
      await emit(page, "start");
      await emit(page, "end");
      await emit(page, "start"); // An already-ended utterance must stay ended.
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await group.getByRole("button", { name: "Replay reply" }).click();
      await emit(page, "start");
      await emit(page, "pause");
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await group.getByRole("button", { name: "Replay reply" }).click();
      await emit(page, "error");
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await expect(group).toContainText("Playback could not start");
      let releaseTurn: (() => void) | undefined;
      await page.route("**/turns", async (route) => {
        const response = await route.fetch();
        await new Promise<void>((resolve) => {
          releaseTurn = resolve;
        });
        await route.fulfill({ response });
      });
      await page.locator("#response").fill(localizedContent[locale].samples[0]);
      await page
        .getByRole("button", {
          name: localizedContent[locale].labels.send,
          exact: true,
        })
        .click();
      await expect(avatar).toHaveAttribute("data-stage", "thinking");
      await expect.poll(() => !!releaseTurn).toBe(true);
      releaseTurn!();
      await expect(avatar).toHaveAttribute("data-stage", "preparing");
      await emit(page, "start");
      await expect(avatar).toHaveAttribute("data-stage", "speaking");
      await page
        .getByRole("button", { name: "Speak response", exact: true })
        .click();
      await expect(avatar).toHaveAttribute("data-stage", "listening");
      await expect(page.locator(".voice-caption")).toHaveCount(0);
      await page.locator("#response").fill("Keep this typed draft");
      let releaseAsr: (() => void) | undefined;
      await page.route("**/speech/transcribe", async (route) => {
        await new Promise<void>((resolve) => {
          releaseAsr = resolve;
        });
        await route.fulfill({
          status: 503,
          json: { error: "Speech temporarily unavailable" },
        });
      });
      await page.waitForTimeout(600);
      await page
        .getByRole("button", { name: "Stop recording", exact: true })
        .click();
      await expect(avatar).toHaveAttribute("data-stage", "transcribing");
      await expect.poll(() => !!releaseAsr).toBe(true);
      releaseAsr!();
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await expect(page.locator("#response")).toHaveValue(
        "Keep this typed draft",
      );
      await group.getByRole("button", { name: "Replay reply" }).click();
      await emit(page, "start");
      await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await page.reload();
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      const beforeFork = await (
        await page.request.get(`/api/sessions/${created.sessionId}`)
      ).json();
      const childResponse = await page.request.post(
        `/api/branches/${created.branchId}/forks`,
        {
          headers,
          data: {
            snapshotId: beforeFork.snapshots.at(-1).id,
            name: "Voice visual alternative",
          },
        },
      );
      expect(childResponse.ok()).toBe(true);
      const child = await childResponse.json();
      await page.reload();
      await group.getByRole("button", { name: "Replay reply" }).click();
      await emit(page, "start");
      await expect(avatar).toHaveAttribute("data-stage", "speaking");
      await page
        .getByRole("combobox", { name: "Current approach" })
        .selectOption(child.branchId);
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await emit(page, "start"); // The old path's cancelled callback cannot animate the child.
      await expect(avatar).toHaveAttribute("data-stage", "ready");
      await expect(page.locator(".voice-caption")).toHaveCount(0);
      const afterVisuals = await (
        await page.request.get(`/api/sessions/${created.sessionId}`)
      ).json();
      expect(afterVisuals.branch.revision).toBe(beforeFork.branch.revision);
      expect(afterVisuals.messages).toEqual(beforeFork.messages);
    } finally {
      await page.request.delete(`/api/sessions/${created.sessionId}`, {
        headers,
      });
    }
  });
