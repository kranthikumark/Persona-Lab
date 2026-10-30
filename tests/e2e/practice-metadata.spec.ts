import { test, expect } from "@playwright/test";
const headers = { origin: "http://127.0.0.1:3101" };
test("V5-04: owned preferences, pinned English metadata, source preservation and unavailable options", async ({
  page,
  playwright,
}) => {
  const foreign = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3101",
  });
  let sessionId: string | undefined;
  try {
    const locales = (await (await page.request.get("/api/capabilities")).json())
      .locales;
    expect(
      locales
        .filter((l: { textAvailable: boolean }) => l.textAvailable)
        .map((l: { locale: string }) => l.locale),
    ).toEqual(["en-IN"]);
    const preferences = await page.request.put("/api/preferences", {
      headers,
      data: { interfaceLocale: "en-IN", coachingLocale: "en-IN", mode: "text" },
    });
    expect(preferences.ok()).toBe(true);
    expect(
      (await (await page.request.get("/api/preferences")).json()).saved,
    ).toBe(true);
    expect((await (await foreign.get("/api/preferences")).json()).saved).toBe(
      false,
    );
    expect(preferences.headers()["cache-control"]).toBe("no-store");
    for (const data of [
      { practiceLocale: "hi-IN" },
      { coachingLocale: "te-IN" },
      { mode: "voice" },
      { localization: { id: "forged" } },
    ]) {
      expect(
        (
          await page.request.put("/api/preferences", { headers, data })
        ).status(),
      ).toBe("practiceLocale" in data ? 422 : 400);
      expect(
        (await page.request.post("/api/sessions", { headers, data })).status(),
      ).toBe("practiceLocale" in data ? 422 : 400);
    }
    expect(
      (
        await page.request.put("/api/preferences", {
          headers: { origin: "https://foreign.invalid" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    const created = await (
      await page.request.post("/api/sessions", {
        headers,
        data: {
          mode: "text",
          practiceLocale: "en-IN",
          characterLocale: "en-IN",
        },
      })
    ).json();
    sessionId = created.sessionId;
    const view = await (
      await page.request.get(`/api/sessions/${sessionId}`)
    ).json();
    expect(view.settings.localization).toMatchObject({
      locale: "en-IN",
      version: 1,
      source: "versioned_baseline",
    });
    expect((await foreign.get(`/api/sessions/${sessionId}`)).status()).toBe(
      404,
    );
    const text = "  English हिन्दी తెలుగు 🙂  ";
    const turn = await page.request.post(
      `/api/branches/${created.branchId}/turns`,
      {
        headers,
        data: {
          text,
          inputModality: "text",
          key: crypto.randomUUID(),
          revision: 0,
        },
      },
    );
    expect(turn.ok()).toBe(true);
    const current = await turn.json();
    expect(current.messages[1].content).toBe(text);
    expect(current.messages[1].source).toMatchObject({
      originalText: text,
      originalLocale: "en-IN",
      modality: "text",
      translations: [],
    });
    const rejected = await page.request.post(
      `/api/branches/${created.branchId}/turns`,
      {
        headers,
        data: {
          text: "Hello",
          inputModality: "voice",
          key: crypto.randomUUID(),
          revision: 1,
        },
      },
    );
    expect(rejected.status()).toBe(400);
    expect(
      await (await page.request.get(`/api/sessions/${sessionId}`)).json(),
    ).toEqual(current);
    const child = await (
      await page.request.post(`/api/branches/${created.branchId}/forks`, {
        headers,
        data: {
          snapshotId: current.snapshots.at(-1).id,
          name: "Same settings",
        },
      })
    ).json();
    expect(
      (
        await (
          await page.request.get(
            `/api/sessions/${sessionId}?branch=${child.branchId}`,
          )
        ).json()
      ).settings,
    ).toEqual(current.settings);
    const report = await (
      await page.request.post(`/api/branches/${created.branchId}/evaluation`, {
        headers,
        data: { revision: 1 },
      })
    ).json();
    expect(report.locales).toMatchObject({
      rubricLocale: "en-IN",
      feedbackLocale: "en-IN",
      practiceLocale: "en-IN",
      localization: current.settings.localization,
    });
    await page.goto(`/sessions/${sessionId}`);
    await expect(page.getByRole("log")).toContainText(
      "English हिन्दी తెలుగు 🙂",
    );
    await page.reload();
    const after = await (
      await page.request.get(`/api/sessions/${sessionId}`)
    ).json();
    expect(after.messages).toEqual(current.messages);
    expect(after.snapshots).toEqual(current.snapshots);
    expect(after.settings).toEqual(current.settings);
    const defaults = await (await foreign.get("/api/preferences")).json();
    expect(defaults.preferences.practiceLocale).toBe("en-IN");
  } finally {
    if (sessionId)
      expect(
        (
          await page.request.delete(`/api/sessions/${sessionId}`, { headers })
        ).ok(),
      ).toBe(true);
    expect(
      (await page.request.delete("/api/preferences", { headers })).ok(),
    ).toBe(true);
    await foreign.dispose();
  }
});
