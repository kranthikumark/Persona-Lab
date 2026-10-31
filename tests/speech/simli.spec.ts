import { test, expect } from "@playwright/test";
const headers = { origin: "http://127.0.0.1:3101" };
test("video needs explicit enable; provider failure preserves voice, portrait and draft", async ({
  page,
}) => {
  await page.route("**/api/capabilities", async (route) => {
    const response = await route.fetch(),
      data = await response.json();
    data.avatar = {
      provider: "simli",
      configured: true,
      customFace: true,
      previewSeconds: 120,
    };
    data.speech.nativePlayback = {
      voices: { "en-IN": "Test installed voice" },
    };
    await route.fulfill({ json: data });
  });
  let attempts = 0;
  await page.route("**/api/branches/*/avatar", async (route) => {
    if (route.request().method() === "POST") {
      attempts++;
      expect(route.request().postDataJSON()).toMatchObject({
        revision: 0,
        leaseId: expect.any(String),
      });
      await route.fulfill({
        status: 503,
        json: {
          error:
            "Simli could not start this avatar. Voice practice is available.",
        },
      });
    } else await route.fulfill({ json: { ended: true } });
  });
  await page.goto("/");
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  try {
    await page.goto(`/sessions/${session.sessionId}`);
    const enable = page.getByRole("button", {
      name: "Enable video avatar",
      exact: true,
    });
    await expect(enable).toBeEnabled();
    expect(attempts).toBe(0);
    await page.locator("#response").fill("Keep this typed response");
    await enable.click();
    await expect(page.locator(".simli-error")).toContainText(
      "Voice practice is available",
    );
    await expect(page.locator(".priya-avatar")).toHaveAttribute(
      "data-renderer",
      "portrait",
    );
    await expect(page.locator("#response")).toHaveValue(
      "Keep this typed response",
    );
    expect(attempts).toBe(1);
    await expect(
      page.getByRole("button", { name: "Speak response", exact: true }),
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});

test("slow video connection queues speech, never falls back to audio, and permits explicit voice-only recovery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class {
        constructor(public text: string) {}
      },
    });
    const events = new EventTarget();
    Object.assign(window, { __deviceSpoken: 0 });
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        getVoices: () => [
          {
            name: "English",
            lang: "en-IN",
            localService: true,
            default: false,
            voiceURI: "test",
          },
        ],
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        cancel: () => {},
        speak: () => {
          (window as unknown as { __deviceSpoken: number }).__deviceSpoken++;
        },
      },
    });
  });
  await page.route("**/api/capabilities", async (route) => {
    const data = await (await route.fetch()).json();
    data.avatar = { configured: true, customFace: true, previewSeconds: 120 };
    data.speech.nativePlayback = { voices: { "en-IN": "Test voice" } };
    await route.fulfill({ json: data });
  });
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/branches/*/avatar", async (route) => {
    if (route.request().method() !== "POST")
      return route.fulfill({ json: { ended: true } });
    await delayed;
    await route.fulfill({
      status: 503,
      json: {
        error: "Video connection unavailable. Retry video or use voice only.",
      },
    });
  });
  await page.goto("/");
  const session = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  let nativeRequests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/speech/playback")) nativeRequests++;
  });
  const spoken = () =>
    page.evaluate(
      () => (window as unknown as { __deviceSpoken: number }).__deviceSpoken,
    );
  try {
    await page.goto(`/sessions/${session.sessionId}`);
    await page
      .getByRole("button", { name: "Enable video avatar", exact: true })
      .click();
    await expect(page.locator(".simli-stage")).toHaveAttribute(
      "data-video-state",
      "connecting",
    );
    await expect(page.locator(".simli-stage video")).toHaveCSS(
      "visibility",
      "visible",
    );
    await page
      .getByRole("button", { name: "Auto speak replies off", exact: true })
      .click();
    await expect(page.locator(".reply-playback small")).toHaveText(
      "Wait… receiving avatar video",
    );
    expect(await spoken()).toBe(0);
    expect(nativeRequests).toBe(0);
    await expect(page.locator(".simli-stage audio")).toHaveJSProperty(
      "muted",
      true,
    );
    await page.getByRole("button", { name: "Stop reply", exact: true }).click();
    await page
      .getByRole("button", { name: "Replay reply", exact: true })
      .click();
    await expect(page.locator(".reply-playback small")).toHaveText(
      "Wait… receiving avatar video",
    );
    release();
    await expect(
      page.getByRole("button", { name: "Retry video", exact: true }),
    ).toBeVisible();
    expect(await spoken()).toBe(0);
    expect(nativeRequests).toBe(0);
    await page
      .getByRole("button", { name: "Use voice only", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Replay reply", exact: true })
      .click();
    await expect.poll(spoken).toBe(1);
  } finally {
    release();
    await page.request.delete(`/api/sessions/${session.sessionId}`, {
      headers,
    });
  }
});

test("a connecting video can present its first frame beneath the wait overlay", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const host = document.createElement("div");
    host.className = "simli-stage connecting";
    Object.assign(host.style, {
      position: "fixed",
      top: "20px",
      left: "20px",
      right: "auto",
      bottom: "auto",
      width: "320px",
      height: "240px",
      zIndex: "100",
    });
    const video = document.createElement("video");
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    const waiting = document.createElement("div");
    waiting.className = "simli-wait";
    waiting.textContent = "Wait… receiving avatar video";
    host.append(video, waiting);
    document.body.append(host);
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const paint = canvas.getContext("2d")!;
    let frame = 0;
    const draw = setInterval(() => {
      paint.fillStyle = ++frame % 2 ? "#504080" : "#403070";
      paint.fillRect(0, 0, 320, 240);
    }, 100);
    const stream = canvas.captureStream(10);
    video.srcObject = stream;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const presented = new Promise<boolean>((resolve) => {
        video.requestVideoFrameCallback(() => resolve(true));
        timeout = setTimeout(() => resolve(false), 5000);
      });
      await video.play();
      return {
        presented: await presented,
        visibility: getComputedStyle(video).visibility,
        muted: video.muted,
        width: video.videoWidth,
      };
    } finally {
      clearTimeout(timeout);
      clearInterval(draw);
      stream.getTracks().forEach((track) => track.stop());
      host.remove();
    }
  });
  expect(result).toEqual({
    presented: true,
    visibility: "visible",
    muted: true,
    width: 320,
  });
});
