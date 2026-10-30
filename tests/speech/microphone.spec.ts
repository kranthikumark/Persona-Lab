import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { validateWav } from "../../src/lib/speech/wav";
const headers = { origin: "http://127.0.0.1:3101" };
async function instrument(page: Page, theme = "dark") {
  await page.addInitScript((theme) => {
    localStorage.setItem("persona-lab-theme", theme);
    const state = {
      calls: [] as MediaStreamConstraints[],
      tracks: [] as MediaStreamTrack[],
      spoken: [] as { text: string; local: boolean }[],
      cancelled: 0,
    };
    let lastUtterance: SpeechSynthesisUtterance | null = null;
    Object.assign(window, { speechTest: state });
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      state.calls.push(constraints!);
      const stream = await original(constraints);
      state.tracks.push(...stream.getTracks());
      return stream;
    };
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        text: string;
        voice: SpeechSynthesisVoice | null = null;
        lang = "";
        constructor(text: string) {
          this.text = text;
        }
      },
      configurable: true,
    });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [
          {
            name: "Synthetic local English",
            voiceURI: "test-local",
            lang: "en-IN",
            localService: true,
            default: true,
          },
          {
            name: "Remote voice must not be used",
            voiceURI: "test-remote",
            lang: "en-US",
            localService: false,
          },
        ],
        addEventListener: () => {},
        removeEventListener: () => {},
        cancel: () => {
          state.cancelled++;
          lastUtterance?.onerror?.({
            error: "canceled",
          } as SpeechSynthesisErrorEvent);
          lastUtterance = null;
        },
        speak: (utterance: SpeechSynthesisUtterance) => {
          lastUtterance = utterance;
          state.spoken.push({
            text: utterance.text,
            local: utterance.voice!.localService,
          });
        },
      },
      configurable: true,
    });
  }, theme);
}
async function record(page: Page) {
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Start microphone", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeEnabled({ timeout: 15000 });
  await page.waitForTimeout(700);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Transcribe with Meta", exact: true }),
  ).toBeEnabled();
}
for (const theme of ["dark", "light"] as const)
  test(`${theme}: consent, real AudioWorklet capture, transcript review, local readback and text recovery`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["microphone"]);
    await instrument(page, theme);
    const session = await (
      await page.request.post("/api/sessions", { headers, data: {} })
    ).json();
    let speechCalls = 0;
    await page.route("**/speech/transcribe", async (route) => {
      speechCalls++;
      const request = route.request();
      const consent = JSON.parse(request.headers()["x-persona-speech-consent"]);
      expect(consent.retention).toBe("ephemeral");
      expect(consent.cameraAnalysis).toBe(false);
      expect(
        validateWav(new Uint8Array(request.postDataBuffer()!)).durationMs,
      ).toBeGreaterThan(250);
      await route.fulfill({
        json: {
          text: "What is your budget?",
          locale: "en-IN",
          provider: "meta",
          model: "muse-voice-transcribe-1.0",
          audioDurationMs: 700,
          latencyMs: 40,
          consentId: consent.id,
          branchId: session.branchId,
          revision: 0,
          retention: "ephemeral",
        },
      });
    });
    try {
      const textResponse = await page.goto(`/sessions/${session.sessionId}`);
      expect(textResponse!.headers()["permissions-policy"]).toBe(
        "camera=(), microphone=(self)",
      );
      await page.locator("#response").fill("Keep my existing text draft.");
      const checkResponse = await page.goto(
        `/sessions/${session.sessionId}/speech-check?branch=${session.branchId}&return=original`,
      );
      expect(checkResponse!.headers()["permissions-policy"]).toBe(
        "camera=(), microphone=(self)",
      );
      await expect(
        page.getByRole("button", { name: "Start microphone", exact: true }),
      ).toBeDisabled();
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { speechTest: { calls: unknown[] } })
              .speechTest.calls.length,
        ),
      ).toBe(0);
      await record(page);
      expect(speechCalls).toBe(0);
      expect(
        await page.evaluate(() => {
          const state = (
            window as unknown as {
              speechTest: {
                calls: MediaStreamConstraints[];
                tracks: MediaStreamTrack[];
              };
            }
          ).speechTest;
          return (
            state.calls.every((c) => c.video === false) &&
            state.tracks.every((t) => t.readyState === "ended")
          );
        }),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Transcribe with Meta", exact: true })
        .click();
      const transcript = page.getByLabel("Editable English transcript");
      await expect(transcript).toHaveValue("What is your budget?");
      expect(speechCalls).toBe(1);
      await transcript.fill(Array(71).fill("word").join(" "));
      await expect(
        page.getByRole("button", { name: "Confirm transcript", exact: true }),
      ).toBeDisabled();
      await transcript.fill(Array(70).fill("word").join(" "));
      await expect(
        page.getByRole("button", { name: "Confirm transcript", exact: true }),
      ).toBeEnabled();
      await transcript.fill(
        "The premium is fixed at ₹1,250. What is your budget?",
      );
      await page
        .getByRole("button", { name: "Confirm transcript", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Transcript confirmed", exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole("option", { name: /Remote voice/ }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Read confirmed transcript", exact: true })
        .click();
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { speechTest: { spoken: unknown[] } })
              .speechTest.spoken,
        ),
      ).toEqual([
        {
          text: "The premium is fixed at ₹1,250. What is your budget?",
          local: true,
        },
      ]);
      await page
        .getByRole("button", { name: "Stop playback", exact: true })
        .click();
      await expect(page.locator(".error-banner")).toHaveCount(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(async () => {
          await document.fonts.ready;
          window.scrollTo({ top: 0, behavior: "instant" });
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        });
        if (width !== 320)
          await page.screenshot({
            path: `docs/screenshots/v5-08/speech-${theme}-${width}.png`,
            fullPage: true,
            animations: "disabled",
          });
      }
      await page.getByRole("checkbox").uncheck();
      await expect(transcript).toHaveValue("");
      await expect(page.locator("audio")).toHaveCount(0);
      const back = page.waitForResponse(
        (r) =>
          r.request().isNavigationRequest() &&
          r.url().includes(`/sessions/${session.sessionId}`),
      );
      await page
        .getByRole("link", { name: "Return to text practice", exact: true })
        .click();
      expect((await back).headers()["permissions-policy"]).toBe(
        "camera=(), microphone=(self)",
      );
      await expect(page.locator("#response")).toHaveValue(
        "Keep my existing text draft.",
      );
      const saved = await (
        await page.request.get(`/api/sessions/${session.sessionId}`)
      ).json();
      expect(saved.branch.revision).toBe(0);
      expect(saved.messages).toHaveLength(1);
    } finally {
      await page.request.delete(`/api/sessions/${session.sessionId}`, {
        headers,
      });
    }
  });
test("permission denial gives text fallback without upload", async ({
  page,
}) => {
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  let uploads = 0;
  await page.route("**/speech/transcribe", (route) => {
    uploads++;
    return route.abort();
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  try {
    await page.goto(`/sessions/${session.sessionId}/speech-check`);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Start microphone", exact: true })
      .click();
    await expect(page.locator(".error-banner")).toContainText(
      "permission was denied",
    );
    expect(uploads).toBe(0);
    await expect(
      page.getByRole("link", { name: "Return to text practice" }),
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});
test("cancellation, hidden page and late responses discard uncommitted speech", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await instrument(page);
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  let release: () => void = () => {};
  await page.route("**/speech/transcribe", async (route) => {
    const consent = JSON.parse(
      route.request().headers()["x-persona-speech-consent"],
    );
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route
      .fulfill({
        json: {
          text: "Late text must be discarded",
          branchId: session.branchId,
          revision: 0,
          consentId: consent.id,
        },
      })
      .catch(() => {});
  });
  try {
    await page.goto(`/sessions/${session.sessionId}/speech-check`);
    await record(page);
    await page
      .getByRole("button", { name: "Transcribe with Meta", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Cancel transcription" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel transcription" }).click();
    release();
    await expect(page.getByLabel("Editable English transcript")).toHaveValue(
      "",
    );
    await page
      .getByRole("button", { name: "Start microphone", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Stop recording", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        get: () => "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(
      page.getByRole("button", { name: "Start microphone", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() =>
        (
          window as unknown as { speechTest: { tracks: MediaStreamTrack[] } }
        ).speechTest.tracks.every((t) => t.readyState === "ended"),
      ),
    ).toBe(true);
    expect(
      (
        await (
          await page.request.get(`/api/sessions/${session.sessionId}`)
        ).json()
      ).branch.revision,
    ).toBe(0);
  } finally {
    release();
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});
test("foreign origin, foreign owner and missing consent never reach speech processing", async ({
  page,
  browser,
}) => {
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  try {
    const endpoint = `http://127.0.0.1:3101/api/branches/${session.branchId}/speech/transcribe`;
    expect(
      (
        await page.request.post(endpoint, {
          headers: { origin: "https://foreign.invalid" },
          data: "bad",
        })
      ).status(),
    ).toBe(403);
    const foreign = await browser.newContext();
    try {
      expect(
        (
          await foreign.request.post(endpoint, { headers, data: "bad" })
        ).status(),
      ).toBe(404);
    } finally {
      await foreign.close();
    }
    expect(
      (
        await page.request.post(endpoint, {
          headers: {
            ...headers,
            "Content-Type": "audio/wav",
            "x-persona-revision": "0",
          },
          data: Buffer.from("bad"),
        })
      ).status(),
    ).toBe(403);
  } finally {
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});
test("cancelling a pending permission request stops a late granted stream", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(() => {
    const real = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    const state = { tracks: [] as MediaStreamTrack[], grant: async () => {} };
    Object.assign(window, { latePermission: state });
    navigator.mediaDevices.getUserMedia = (constraints) =>
      new Promise((resolve) => {
        state.grant = async () => {
          const stream = await real(constraints);
          state.tracks.push(...stream.getTracks());
          resolve(stream);
        };
      });
  });
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  try {
    await page.goto(`/sessions/${session.sessionId}/speech-check`);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Start microphone", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Cancel microphone" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Cancel microphone" }).click();
    await page.evaluate(async () => {
      await (
        window as unknown as { latePermission: { grant: () => Promise<void> } }
      ).latePermission.grant();
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as unknown as {
              latePermission: { tracks: MediaStreamTrack[] };
            }
          ).latePermission.tracks.every(
            (track) => track.readyState === "ended",
          ),
        ),
      )
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Start microphone", exact: true }),
    ).toBeEnabled();
    await expect(page.locator("audio")).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});
