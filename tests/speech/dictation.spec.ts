import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { createHmac, createHash, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const headers = { origin: "http://127.0.0.1:3101" };
const choiceKey = "persona-voice-choice-v1";
const choiceValue = "allow-meta-transcription-no-audio-retention";
async function installAsr(
  page: Page,
  context: BrowserContext,
  branchId: string,
  onRequest: () => void = () => {},
) {
  await page.route("**/speech/transcribe", async (route) => {
    onRequest();
    const consent = JSON.parse(
        route.request().headers()["x-persona-speech-consent"],
      ),
      revision = Number(route.request().headers()["x-persona-revision"]);
    const payload = {
      version: "speech-receipt-v1",
      id: randomUUID(),
      branchId,
      revision,
      locale: "en-IN",
      model: "muse-voice-transcribe-1.0",
      rawText: "What is your budget",
      audioDurationMs: 1000,
      consent,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const ownerToken = (await context.cookies()).find(
      (c) => c.name === "persona_owner",
    )!.value;
    const owner = createHash("sha256").update(ownerToken).digest("hex");
    const signature = createHmac("sha256", "synthetic-never-used-for-network")
      .update("persona-speech-receipt-v1\0")
      .update(owner)
      .update("\0")
      .update(encoded)
      .digest("base64url");
    await route.fulfill({
      json: {
        text: payload.rawText,
        receipt: `${encoded}.${signature}`,
        locale: "en-IN",
        provider: "meta",
        model: payload.model,
        audioDurationMs: 1000,
        latencyMs: 30,
        consentId: consent.id,
        branchId,
        revision,
        retention: "ephemeral",
      },
    });
  });
}
async function stop(page: Page) {
  await expect(
    page.getByRole("button", { name: "Stop recording", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(700);
  await page
    .getByRole("button", { name: "Stop recording", exact: true })
    .click();
}
for (const theme of ["dark", "light"] as const)
  test(`${theme}: inline stop automatically transcribes and appends; consent is remembered`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["microphone"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (theme) => localStorage.setItem("persona-lab-theme", theme),
      theme,
    );
    let id: string | undefined;
    try {
      await page.goto("/");
      await page
        .getByRole("button", { name: "Begin practice", exact: true })
        .click();
      await expect(page).toHaveURL(/\/sessions\//);
      id = new URL(page.url()).pathname.split("/")[2];
      const initial = await (
        await page.request.get(`/api/sessions/${id}`)
      ).json();
      let uploads = 0;
      await installAsr(page, context, initial.branch.id, () => {
        uploads++;
      });
      await page.locator("#response").fill("Existing keyboard draft.");
      await page
        .getByRole("button", { name: "Speak response", exact: true })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("region", { name: "Voice permission", exact: true }),
      ).toBeVisible();
      expect(uploads).toBe(0);
      await page
        .getByRole("button", { name: "Allow and speak", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Stop recording", exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("button", { name: "Send response", exact: true }),
      ).toBeDisabled();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page
          .locator(".composer-area")
          .screenshot({
            path: `docs/screenshots/v5-09/inline-${theme}-recording-${width}.png`,
            animations: "disabled",
          });
      }
      await stop(page);
      await expect(page.locator("#response")).toHaveValue(
        "Existing keyboard draft.\nWhat is your budget",
      );
      expect(uploads).toBe(1);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page
          .locator(".composer-area")
          .screenshot({
            path: `docs/screenshots/v5-09/inline-${theme}-ready-${width}.png`,
            animations: "disabled",
          });
      }
      const edited = "What is your monthly budget?";
      await page.locator("#response").fill(Array(71).fill("word").join(" "));
      await expect(
        page.getByRole("button", { name: "Send response", exact: true }),
      ).toBeDisabled();
      await page.locator("#response").fill(edited);
      expect(
        (await new AxeBuilder({ page }).include(".composer-area").analyze())
          .violations,
      ).toEqual([]);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.reload();
      await expect(page.locator("#response")).toHaveValue(edited);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Send response", exact: true })
        .click();
      await expect(
        page.getByText("Turn 1 · Voice, reviewed", { exact: true }),
      ).toBeVisible();
      const saved = await (
        await page.request.get(`/api/sessions/${id}`)
      ).json();
      expect(saved.branch.revision).toBe(1);
      expect(saved.messages[1].source).toMatchObject({
        modality: "voice",
        originalText: edited,
        transcript: { rawText: "What is your budget", confirmedByUser: true },
      });
      await page
        .getByRole("button", { name: "Speak response", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Stop recording", exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("region", { name: "Voice permission", exact: true }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Cancel recording", exact: true })
        .click();
      expect(uploads).toBe(1);
      await page
        .getByRole("button", { name: "Voice settings", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Turn off voice input", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Speak response", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Allow and speak", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Stop recording", exact: true }),
      ).toHaveCount(0);
    } finally {
      if (id) await page.request.delete(`/api/sessions/${id}`, { headers });
    }
  });
test("cancelling and permission denial preserve the draft; a late transcript cannot append", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: choiceKey, value: choiceValue },
  );
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  let release: () => void = () => {};
  await page.route("**/speech/transcribe", async (route) => {
    await new Promise<void>((r) => {
      release = r;
    });
    await route
      .fulfill({ json: { text: "Late words", receipt: "invalid" } })
      .catch(() => {});
  });
  try {
    await page.goto(`/sessions/${session.sessionId}`);
    await page.locator("#response").fill("Keep this draft.");
    await page
      .getByRole("button", { name: "Speak response", exact: true })
      .click();
    await stop(page);
    await expect(
      page.getByRole("button", { name: "Cancel transcription", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Cancel transcription", exact: true })
      .click();
    release();
    await expect(page.locator("#response")).toHaveValue("Keep this draft.");
    await expect(
      page.getByRole("button", { name: "Send response", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("Denied", "NotAllowedError");
      };
    });
    await page
      .getByRole("button", { name: "Speak response", exact: true })
      .click();
    await expect(page.getByText(/Microphone blocked/)).toBeVisible();
    await expect(page.locator("#response")).toHaveValue("Keep this draft.");
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
test("typing during transcription is preserved when recognized words arrive", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: choiceKey, value: choiceValue },
  );
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  let release: () => void = () => {};
  await page.route("**/speech/transcribe", async (route) => {
    const consent = JSON.parse(
      route.request().headers()["x-persona-speech-consent"],
    );
    await new Promise<void>((r) => {
      release = r;
    });
    await route.fulfill({
      json: {
        text: "Recognized words",
        receipt: "browser-preview-only",
        branchId: session.branchId,
        revision: 0,
        consentId: consent.id,
      },
    });
  });
  try {
    await page.goto(`/sessions/${session.sessionId}`);
    await page.locator("#response").fill("First draft");
    await page
      .getByRole("button", { name: "Speak response", exact: true })
      .click();
    await stop(page);
    await expect(
      page.getByRole("button", { name: "Cancel transcription", exact: true }),
    ).toBeVisible();
    await page.locator("#response").fill("Latest draft edits");
    release();
    await expect(page.locator("#response")).toHaveValue(
      "Latest draft edits\nRecognized words",
    );
    await expect(
      page.getByRole("button", { name: "Send response", exact: true }),
    ).toBeEnabled();
  } finally {
    release();
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});
test("failed automatic transcription preserves words and can be retried inline", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: choiceKey, value: choiceValue },
  );
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  try {
    await page.route("**/speech/transcribe", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Speech temporarily unavailable" },
      }),
    );
    await page.goto(`/sessions/${session.sessionId}`);
    await page.locator("#response").fill("Keep this draft");
    await page
      .getByRole("button", { name: "Speak response", exact: true })
      .click();
    await stop(page);
    await expect(
      page.getByText("Speech temporarily unavailable", { exact: false }),
    ).toBeVisible();
    await expect(page.locator("#response")).toHaveValue("Keep this draft");
    await page.unroute("**/speech/transcribe");
    await installAsr(page, context, session.branchId);
    await page
      .getByRole("button", { name: "Retry transcription", exact: true })
      .click();
    await expect(page.locator("#response")).toHaveValue(
      "Keep this draft\nWhat is your budget",
    );
    await expect(
      page.getByRole("button", { name: "Allow and speak", exact: true }),
    ).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});
