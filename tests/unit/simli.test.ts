import { afterEach, expect, it, vi } from "vitest";
import { simliConfig, simliToken, simliIce } from "@/lib/avatar/simli";
import { wavToSimliPcm } from "@/lib/avatar/pcm";
import { encodeWav } from "@/lib/speech/wav";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("gets relay credentials server-side and rejects unsafe relay configuration without leaking errors", async () => {
  vi.stubEnv("SIMLI_API_KEY", "synthetic-account-secret");
  const request = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          urls: "turn:relay.example.test:443?transport=tcp",
          username: "ephemeral",
          credential: "temporary",
        },
      ]),
    ),
  );
  vi.stubGlobal("fetch", request);
  await expect(simliIce()).resolves.toEqual([
    {
      urls: "turn:relay.example.test:443?transport=tcp",
      username: "ephemeral",
      credential: "temporary",
    },
  ]);
  expect(request.mock.calls[0][0]).toBe("https://api.simli.ai/compose/ice");
  expect(request.mock.calls[0][1].redirect).toBe("error");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([{ urls: "https://unexpected.example.test" }]),
        ),
      ),
  );
  await expect(simliIce()).rejects.toThrow("Video relay could not connect");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("synthetic-account-secret", { status: 503 }),
      ),
  );
  await expect(simliIce()).rejects.toThrow("Video relay could not connect");
});
it("uses a documented template only when a custom face is omitted and never returns credentials in configuration", () => {
  const config = simliConfig({ SIMLI_API_KEY: "synthetic-private-key" });
  expect(config.configured).toBe(true);
  expect(config.customFace).toBe(false);
  expect(JSON.stringify(config)).not.toContain("synthetic-private-key");
  expect(
    simliConfig({ SIMLI_API_KEY: "synthetic", SIMLI_FACE_ID: "bad" })
      .configured,
  ).toBe(false);
});
it("converts one-second PCM WAV to raw little-endian 16k mono and rejects corrupt containers", () => {
  const wav = encodeWav(new Float32Array(24000).fill(0.5), 24000);
  const pcm = wavToSimliPcm(wav);
  expect(pcm.length).toBe(32000);
  expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(16384);
  const stereo = wav.slice();
  new DataView(stereo.buffer).setUint16(22, 2, true);
  const badChunk = wav.slice();
  new DataView(badChunk.buffer).setUint32(40, 0xffffffff, true);
  for (const value of [new Uint8Array(), stereo, badChunk])
    expect(() => wavToSimliPcm(value)).toThrow();
});
it("mints bounded avatar-only tokens at the fixed host and hides provider failures", async () => {
  vi.stubEnv("SIMLI_API_KEY", "synthetic-secret-do-not-display");
  const request = vi
    .fn()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ session_token: "short-lived-session-token" }),
        ),
    );
  vi.stubGlobal("fetch", request);
  expect(await simliToken("face")).toBe("short-lived-session-token");
  const [url, init] = request.mock.calls[0];
  expect(url).toBe("https://api.simli.ai/compose/token");
  expect(init.redirect).toBe("error");
  expect(JSON.parse(init.body)).toMatchObject({
    faceId: "face",
    maxSessionLength: 120,
    maxIdleTime: 60,
    handleSilence: true,
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("synthetic-secret-do-not-display", { status: 403 }),
      ),
  );
  await expect(simliToken("face")).rejects.toThrow("Check your account access");
});
