import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";
// Explicit opt-in: this opens a bounded, metered avatar preview using the app's server key.
if (!process.argv.includes("--live-avatar"))
  throw new Error("Pass --live-avatar to run a real, metered Simli preview.");
const locale =
  process.argv.find((v) => v.startsWith("--locale="))?.split("=")[1] ?? "en-IN";
if (!["en-IN", "hi-IN", "te-IN"].includes(locale))
  throw new Error("Choose en-IN, hi-IN or te-IN.");
const root = "http://127.0.0.1:3100",
  headers = { origin: root };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext();
await context.addInitScript(() => {
  const Original = window.RTCPeerConnection;
  const peers: RTCPeerConnection[] = [];
  Object.assign(window, { __avatarPeers: peers });
  window.RTCPeerConnection = class extends Original {
    constructor(config?: RTCConfiguration) {
      super(config);
      peers.push(this);
    }
  };
});
const page = await context.newPage();
const playbackRequests: {status:number;at:number}[] = [];
page.on("response",response=> {if(response.url().endsWith("/speech/playback"))playbackRequests.push({status:response.status(),at:Date.now()});});
const mediaSamples: unknown[] = [];
let sampling = false;
const sampleTimer = setInterval(async () => {
  if (sampling || mediaSamples.length >= 65) return;
  sampling = true;
  try {
    const sample = await page.locator(".simli-stage video").evaluate(
      async (v: HTMLVideoElement) => {
        const stats: Record<string, unknown>[] = [];
        for (const peer of (
          window as unknown as { __avatarPeers: RTCPeerConnection[] }
        ).__avatarPeers) {
          if (peer.connectionState === "closed") continue;
          const reports = await peer.getStats();
          reports.forEach((report) => {
            if (report.type === "inbound-rtp")
              stats.push({
                kind: report.kind,
                bytes: report.bytesReceived,
                framesDecoded: report.framesDecoded,
                keyFramesDecoded: report.keyFramesDecoded,
                framesReceived: report.framesReceived,
                packetsLost: report.packetsLost,
                pliCount: report.pliCount,
                codec: reports.get(report.codecId)?.mimeType,
              });
          });
        }
        return {
          width: v.videoWidth,
          readyState: v.readyState,
          paused: v.paused,
          time: v.currentTime,
          attached: !!v.srcObject,
          visibility: getComputedStyle(v).visibility,
          hidden: document.hidden,
          stats,
        };
      },
      undefined,
      { timeout: 1000 },
    );
    mediaSamples.push(sample);
  } catch {
    /* Page may be loading or closing. */
  } finally {
    sampling = false;
  }
}, 1000);
const signals: { direction: string; signal: string; at: number }[] = [];
const startedAt = Date.now();
page.on("websocket", (socket) => {
  const record = (direction: string, payload: string | Buffer) => {
    if (
      typeof payload === "string" &&
      /^(SPEAK|SILENT|SKIP|STOP|ACK)$/.test(payload)
    )
      signals.push({
        direction,
        signal: payload,
        at: Date.now() - startedAt,
      });
  };
  socket.on("framereceived", ({ payload }) => record("framereceived", payload));
  socket.on("framesent", ({ payload }) => record("framesent", payload));
});
let session: { sessionId: string } | undefined;
const evidence: Record<string, unknown> = {
  date: new Date().toISOString().slice(0, 10),
  provider: "simli",
  locale,
  scope:
    "Real configured face, native speech audio and WebRTC playback; no human hearing/lip-sync quality claim",
};
try {
  await page.goto(root);
  const created = await context.request.post(root + "/api/sessions", {
    headers,
    data: { practiceLocale: locale },
  });
  if (!created.ok())
    throw new Error("Could not create owned acceptance practice");
  session = await created.json();
  let initial = await (
    await context.request.get(root + "/api/sessions/" + session!.sessionId)
  ).json();
  await page.goto(root + "/sessions/" + session!.sessionId);
  await page
    .getByRole("button", { name: "Enable video avatar", exact: true })
    .click();
  await page.locator(".simli-stage.ready").waitFor({ timeout: 75000 });
  evidence.videoDimensions = await page
    .locator(".simli-stage video")
    .evaluate((v: HTMLVideoElement) => ({
      width: v.videoWidth,
      height: v.videoHeight,
      readyState: v.readyState,
    }));
  evidence.step = "request saved-reply playback";
  await page.getByRole("button", { name: "Replay reply", exact: true }).click();
  await page
    .locator('.priya-avatar[data-stage="speaking"]')
    .waitFor({ timeout: 40000 });
  evidence.savedReplySpeaking = true;
  evidence.replyAudioOutput = await page
    .locator(".simli-stage audio")
    .evaluate((a: HTMLAudioElement) => ({
      muted: a.muted,
      paused: a.paused,
      readyState: a.readyState,
    }));
  if (
    (evidence.replyAudioOutput as { muted: boolean; paused: boolean }).muted ||
    (evidence.replyAudioOutput as { muted: boolean; paused: boolean }).paused
  )
    throw new Error("Avatar audio did not start");
  evidence.step = "stop and replay controls";
  await page.waitForTimeout(600);
  await page.locator(".character-panel").screenshot({
    path: `docs/screenshots/v5-09/simli-${locale}-speaking.png`,
  });
  await page.getByRole("button", { name: "Stop reply", exact: true }).click();
  await page.locator('.priya-avatar[data-stage="ready"]').waitFor();
  evidence.stopMutedAudio = await page
    .locator(".simli-stage audio")
    .evaluate((a: HTMLAudioElement) => a.muted);
  if (process.argv.includes("--send-test-turn")) {
    evidence.step = "enable automatic playback";
    await page
      .getByRole("button", { name: "Auto speak replies off", exact: true })
      .click();
    await page
      .locator('.priya-avatar[data-stage="speaking"]')
      .waitFor({ timeout: 40000 });
    await page.getByRole("button", { name: "Stop reply", exact: true }).click();
    evidence.step = "new conversation turn";
    await page.locator("#response").fill("What is your monthly budget?");
    await page
      .getByRole("button", { name: "Send response", exact: true })
      .click();
    await page
      .locator('.priya-avatar[data-stage="speaking"]')
      .waitFor({ timeout: 40000 });
    initial = await (
      await context.request.get(root + "/api/sessions/" + session!.sessionId)
    ).json();
    evidence.conversationProvider = initial.provider;
    evidence.newSavedReplyAutomaticallySpoken =
      initial.branch.revision === 1 && initial.messages.length === 3;
    await page.getByRole("button", { name: "Stop reply", exact: true }).click();
  }
  evidence.step = "replay before recording interruption";
  await page.getByRole("button", { name: "Replay reply", exact: true }).click();
  await page
    .locator('.priya-avatar[data-stage="speaking"]')
    .waitFor({ timeout: 40000 });
  await page.evaluate(() =>
    window.dispatchEvent(new Event("persona-microphone-start")),
  );
  await page.locator('.priya-avatar[data-stage="ready"]').waitFor();
  evidence.recordingSignalMutedAudio = await page
    .locator(".simli-stage audio")
    .evaluate((a: HTMLAudioElement) => a.muted);
  evidence.step = "replay before ending video";
  await page.getByRole("button", { name: "Replay reply", exact: true }).click();
  await page
    .locator('.priya-avatar[data-stage="speaking"]')
    .waitFor({ timeout: 40000 });
  await page.getByRole("button", { name: "End video", exact: true }).click();
  await page.locator('.priya-avatar[data-stage="ready"]').waitFor();
  evidence.endWhileSpeakingReturnedReady = true;
  await page.locator(".simli-stage.idle").waitFor();
  evidence.closedMediaTracks = await page
    .locator(".simli-stage video")
    .evaluate((v: HTMLVideoElement) => v.srcObject === null);
  const after = await (
    await context.request.get(root + "/api/sessions/" + session!.sessionId)
  ).json();
  evidence.historyUnchanged =
    JSON.stringify(initial.messages) === JSON.stringify(after.messages) &&
    initial.branch.revision === after.branch.revision;
  evidence.status = "passed";
} catch {
  evidence.status = "incomplete";
  evidence.stage = await page
    .locator(".priya-avatar")
    .getAttribute("data-stage")
    .catch(() => null);
  evidence.playbackNotice = await page
    .locator(".reply-playback small")
    .allTextContents()
    .catch(() => []);
  await page
    .locator(".character-panel")
    .screenshot({
      path: `docs/screenshots/v5-09/simli-${locale}-incomplete.png`,
    })
    .catch(() => {});
  evidence.visibleError = await page
    .locator(".simli-error")
    .allTextContents()
    .catch(() => []);
  process.exitCode = 1;
} finally {
  clearInterval(sampleTimer);
  evidence.mediaSamples = mediaSamples;
  evidence.playbackRequests = playbackRequests;
  evidence.controlSignals = signals.filter((s) => s.signal !== "ACK");
  await page.close();
  if (session)
    await context.request.delete(root + "/api/sessions/" + session.sessionId, {
      headers,
    });
  await browser.close();
  await writeFile(
    `docs/verification/v5-09/simli-live-${locale}.json`,
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
}
