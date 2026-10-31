import { test, expect } from "@playwright/test";
const headers = { origin: "http://127.0.0.1:3101" };
test("installed Telugu fallback plays actual WAV when Web Speech has no Telugu; remains owned and read-only", async ({
  page,
  browser,
}) => {
  const capability = await (await page.request.get("/api/capabilities")).json();
  test.skip(
    !capability.speech.nativePlayback?.voices["te-IN"],
    "Requires an installed Mac Telugu voice; not a synthetic voice pass",
  );
  // Simulate the stale/missing Web Speech catalog only; WAV synthesis and HTMLAudio are real.
  await page.addInitScript(() => {
    if (window.speechSynthesis)
      Object.defineProperty(window.speechSynthesis, "getVoices", {
        value: () => [],
      });
  });
  await page.goto("/");
  const created = await (
    await page.request.post("/api/sessions", {
      headers,
      data: { practiceLocale: "te-IN" },
    })
  ).json();
  try {
    const before = await (
      await page.request.get(`/api/sessions/${created.sessionId}`)
    ).json();
    const input = { messageId: before.messages[0].id, revision: 0 };
    const url = `/api/branches/${created.branchId}/speech/playback`;
    expect(
      (
        await page.request.post(url, {
          headers: { origin: "https://foreign.invalid" },
          data: input,
        })
      ).status(),
    ).toBe(403);
    const foreign = await browser.newContext();
    try {
      expect(
        (
          await foreign.request.post(`http://127.0.0.1:3101${url}`, {
            headers,
            data: input,
          })
        ).status(),
      ).toBe(404);
    } finally {
      await foreign.close();
    }
    expect(
      (
        await page.request.post(url, {
          headers,
          data: { ...input, revision: 1 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.post(url, {
          headers,
          data: { ...input, messageId: "foreign-message" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.post(url, {
          headers,
          data: { ...input, text: "Cannot synthesize arbitrary text" },
        })
      ).status(),
    ).toBe(400);
    await page.goto(`/sessions/${created.sessionId}`);
    const playback = page.getByRole("group", { name: "Spoken AI replies" });
    await expect(playback).toContainText("installed on this Mac");
    await page.locator(".composer-area").screenshot({ path: "docs/screenshots/v5-09/native-telugu-ready.png" });
    const audioResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/speech/playback") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Auto speak replies off" }).click();
    const audio = await audioResponse;
    expect(audio.status()).toBe(200);
    expect(audio.headers()["content-type"]).toBe("audio/wav");
    expect(audio.headers()["cache-control"]).toContain("no-store");
    const direct = await page.request.post(url, { headers, data: input });
    expect((await direct.body()).byteLength).toBeGreaterThan(44);
    await expect(page.locator(".priya-avatar")).toHaveAttribute(
      "data-stage",
      "speaking",
      { timeout: 15000 },
    );
    await expect(page.locator(".voice-caption p")).toHaveText(
      before.messages[0].content,
    );
    await page.getByRole("button", { name: "Stop reply" }).click();
    await expect(page.locator(".priya-avatar")).toHaveAttribute(
      "data-stage",
      "ready",
    );
    await page.getByRole("button", { name: "Replay reply" }).click();
    await expect(page.locator(".priya-avatar")).toHaveAttribute(
      "data-stage",
      "speaking",
      { timeout: 15000 },
    );
    await page.evaluate(() =>
      window.dispatchEvent(new Event("persona-microphone-start")),
    );
    await expect(page.locator(".priya-avatar")).toHaveAttribute(
      "data-stage",
      "ready",
    );
    const after = await (
      await page.request.get(`/api/sessions/${created.sessionId}`)
    ).json();
    expect(after.messages).toEqual(before.messages);
    expect(after.branch.revision).toBe(before.branch.revision);
  } finally {
    await page.request.delete(`/api/sessions/${created.sessionId}`, {
      headers,
    });
  }
});
