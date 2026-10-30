import { afterEach, expect, it, vi } from "vitest";
import {
  newConsent,
  validConsent,
  MAX_AUDIO_BYTES,
} from "@/lib/speech/contracts";
import { encodeWav, validateWav } from "@/lib/speech/wav";
import { transcribeMeta } from "@/lib/speech/provider";
import { readAudioBody } from "@/lib/speech/service";
import { speechCapabilities } from "@/lib/speech/capabilities";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("consent requires explicit capture/processing, no retention/analysis, and a bounded current lifetime", () => {
  const consent = newConsent();
  expect(validConsent(consent)).toEqual(consent);
  for (const value of [
    { ...consent, capture: false },
    { ...consent, retention: "saved" },
    { ...consent, cameraAnalysis: true },
    { ...consent, purpose: "camera_coaching" },
    { ...consent, extra: true },
    { ...consent, expiresAt: new Date(0).toISOString() },
    { ...consent, expiresAt: new Date(Date.now() + 86400000).toISOString() },
  ])
    expect(() => validConsent(value)).toThrow();
});
it("encodes/resamples mono 16-bit PCM and rejects corrupt, oversized, stereo and overlong WAV", () => {
  for (const rate of [24000, 44100, 48000]) {
    const bytes = encodeWav(new Float32Array(rate).fill(0.1), rate);
    expect(validateWav(bytes)).toEqual({ durationMs: 1000, sampleRate: 24000 });
  }
  const valid = encodeWav(new Float32Array(24000), 24000);
  const stereo = valid.slice();
  new DataView(stereo.buffer).setUint16(22, 2, true);
  const invalid = valid.slice();
  invalid[0] = 0;
  const corrupt = valid.slice();
  new DataView(corrupt.buffer).setUint32(40, 0xffffffff, true);
  for (const bytes of [
    new Uint8Array(MAX_AUDIO_BYTES + 1),
    new Uint8Array(0),
    stereo,
    invalid,
    corrupt,
    encodeWav(new Float32Array(1), 24000),
  ])
    expect(() => validateWav(bytes)).toThrow();
  expect(() => encodeWav(new Float32Array(24000 * 61), 24000)).toThrow();
});
it("stream-bounds audio bodies even when content-length is missing or false", async () => {
  const big = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: new Uint8Array(MAX_AUDIO_BYTES + 1),
  });
  await expect(readAudioBody(big)).rejects.toMatchObject({ status: 413 });
  const wrong = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "audio/mpeg" },
    body: new Uint8Array(10),
  });
  await expect(readAudioBody(wrong)).rejects.toMatchObject({ status: 415 });
});
it("local acceptance gate does not enable full voice or unverified native speech", () => {
  const speech = speechCapabilities({
    NODE_ENV: "development",
    APP_ORIGIN: "http://127.0.0.1:3100",
    PERSONA_LOCALE_ACCEPTANCE: "0",
    META_API_KEY: "synthetic-server-only",
  });
  expect(speech.checkAvailable).toBe(true);
  expect(speech.fullVoiceConversation).toBe(false);
  expect(speech.locales[1].transcription).toBe("not_verified");
  for (const env of [
    { NODE_ENV: "production" },
    { APP_ORIGIN: "https://example.com" },
    { META_API_KEY: "" },
    { PERSONA_SPEECH_ACCEPTANCE: "false" },
    { PERSONA_SPEECH_ACCEPTANCE: "invalid" },
    { APP_ORIGIN: "not-a-url" },
  ])
    expect(
      speechCapabilities({
        NODE_ENV: "development",
        APP_ORIGIN: "http://127.0.0.1:3100",
        PERSONA_LOCALE_ACCEPTANCE: "0",
        META_API_KEY: "synthetic",
        ...env,
      }).checkAvailable,
    ).toBe(false);
});
it("Meta adapter sends documented multipart only to the fixed host and returns bounded text", async () => {
  vi.stubEnv("META_API_KEY", "test-server-only-key");
  const mock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        transcript: "What is your budget?",
        audioDurationMs: 1000,
        turns: [],
      }),
    ),
  );
  vi.stubGlobal("fetch", mock);
  const result = await transcribeMeta(
    encodeWav(new Float32Array(24000), 24000),
  );
  expect(result.text).toBe("What is your budget?");
  const [url, request] = mock.mock.calls[0];
  expect(url).toBe("https://api.meta.ai/v1/asr/transcribe");
  expect(request.redirect).toBe("error");
  expect(JSON.parse(await request.body.get("request").text())).toMatchObject({
    audioEncoding: "WAV",
    mode: "PUSH_TO_TALK",
    languageBias: ["English"],
  });
  expect(request.body.get("audio").size).toBe(48044);
});
it("provider failure, blank output, malformed output and cancellation return safe errors", async () => {
  vi.stubEnv("META_API_KEY", "never-print-this-test-key");
  for (const response of [
    new Response("secret provider details", { status: 401 }),
    new Response(JSON.stringify({ transcript: "", audioDurationMs: 1 })),
    new Response(JSON.stringify({ transcript: 42, audioDurationMs: 1 })),
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(transcribeMeta(new Uint8Array(44))).rejects.toThrow(
      /speech|Speech/,
    );
  }
  const abort = new AbortController();
  abort.abort();
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("secret")));
  await expect(
    transcribeMeta(new Uint8Array(44), abort.signal),
  ).rejects.toMatchObject({ status: 408 });
});

for (const [locale, language] of [
  ["hi-IN", "Hindi"],
  ["te-IN", "Telugu"],
] as const)
  it(`${locale}: uses documented language bias and remains gated outside local language preview`, async () => {
    const env = {
      NODE_ENV: "development",
      APP_ORIGIN: "http://127.0.0.1:3100",
      META_API_KEY: "synthetic",
      PERSONA_LOCALE_ACCEPTANCE: "1",
    };
    expect(
      speechCapabilities(env).locales.find((l) => l.locale === locale)
        ?.transcription,
    ).toBe("acceptance_preview");
    expect(
      speechCapabilities({ ...env, NODE_ENV: "production" }).locales.find(
        (l) => l.locale === locale,
      )?.transcription,
    ).toBe("not_verified");
    vi.stubEnv("META_API_KEY", "synthetic");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ transcript: "native text", audioDurationMs: 1000 }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(
      (await transcribeMeta(new Uint8Array(44), undefined, locale)).locale,
    ).toBe(locale);
    expect(
      JSON.parse(await fetcher.mock.calls[0][1].body.get("request").text())
        .languageBias,
    ).toEqual([language]);
  });
