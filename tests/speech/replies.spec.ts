import { test, expect } from "@playwright/test";
import { localizedContent } from "../../src/lib/localization/content";
const headers = { origin: "http://127.0.0.1:3101" };
for (const locale of ["en-IN", "hi-IN", "te-IN"] as const) {
  test(`${locale}: opt-in automatic replies, stop/replay, no historical replay, microphone interruption`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        value: class {
          text: string;
          voice: unknown;
          lang = "";
          rate = 1;
          onend: unknown;
          onerror: unknown;
          constructor(text: string) {
            this.text = text;
          }
        },
      });
      const events = new EventTarget();
      const state = {
        spoken: [] as { text: string; lang: string }[],
        cancelled: 0,
      };
      Object.assign(window, { __speechTest: state });
      Object.defineProperty(window, "speechSynthesis", {
        value: {
          getVoices: () =>
            ["en-IN", "hi-IN", "te-IN"].map((lang) => ({
              name: lang,
              lang,
              localService: true,
              default: false,
              voiceURI: lang,
            })),
          addEventListener: events.addEventListener.bind(events),
          removeEventListener: events.removeEventListener.bind(events),
          cancel: () => {
            state.cancelled++;
          },
          speak: (u: SpeechSynthesisUtterance) => {
            state.spoken.push({ text: u.text, lang: u.lang });
          },
        },
      });
    });
    await page.goto("/");
    const created = await page.request.post("/api/sessions", {
      headers,
      data: { practiceLocale: locale },
    });
    expect(created.ok()).toBe(true);
    const session = await created.json();
    try {
      await page.goto(`/sessions/${session.sessionId}`);
      const group = page.getByRole("group", { name: "Spoken AI replies" });
      const toggle = group.getByRole("button", {
        name: "Auto speak replies off",
      });
      await expect(toggle).toBeEnabled();
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { __speechTest: { spoken: unknown[] } })
              .__speechTest.spoken.length,
        ),
      ).toBe(0);
      await toggle.click();
      await expect(
        group.getByRole("button", { name: "Stop reply" }),
      ).toBeVisible();
      await group.getByRole("button", { name: "Stop reply" }).click();
      await group.getByRole("button", { name: "Replay reply" }).click();
      await page.locator("#response").fill(localizedContent[locale].samples[0]);
      await page
        .getByRole("button", {
          name: localizedContent[locale].labels.send,
          exact: true,
        })
        .click();
      await expect(page.locator("#response")).toHaveValue("");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { __speechTest: { spoken: unknown[] } })
                .__speechTest.spoken.length,
          ),
        )
        .toBe(3);
      const state = await page.evaluate(
        () =>
          (
            window as unknown as {
              __speechTest: { spoken: { lang: string }[] };
            }
          ).__speechTest,
      );
      expect(state.spoken.every((v) => v.lang === locale)).toBe(true);
      await page.evaluate(() =>
        window.dispatchEvent(new Event("persona-microphone-start")),
      );
      await expect(
        group.getByRole("button", { name: "Stop reply" }),
      ).toHaveCount(0);
      await page.reload();
      await expect(
        group.getByRole("button", { name: "Auto speak replies off" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { __speechTest: { spoken: unknown[] } })
              .__speechTest.spoken.length,
        ),
      ).toBe(0);
      await expect(
        page.getByRole("button", { name: "Speak response", exact: true }),
      ).toBeVisible();
    } finally {
      await page.request.delete(`/api/sessions/${session.sessionId}`, {
        headers,
      });
    }
  });
}
test("missing Telugu voice does not speak English or use a remote voice", async ({
  page,
}) => {
  await page.route("**/api/capabilities", async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.speech.nativePlayback = { voices: {} };
    await route.fulfill({ json: data });
  });

  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [
          { lang: "en-IN", localService: true },
          { lang: "te-IN", localService: false },
        ],
        addEventListener: () => {},
        removeEventListener: () => {},
        cancel: () => {},
        speak: () => {
          throw new Error("Must not speak");
        },
      },
    });
  });
  await page.goto("/");
  const session = await (
    await page.request.post("/api/sessions", {
      headers,
      data: { practiceLocale: "te-IN" },
    })
  ).json();
  try {
    await page.goto(`/sessions/${session.sessionId}`);
    await expect(
      page.getByText("No installed Telugu voice is available.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Auto speak replies off" }),
    ).toBeDisabled();
    await expect(page.locator("#response")).toBeEnabled();
  } finally {
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});
