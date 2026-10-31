import { expect, it } from "vitest";
import { nativePlaybackEnabled } from "@/lib/speech/native-playback";
it("installed Mac playback is development-loopback only and cannot enable a remote or production fallback", () => {
  const env = { NODE_ENV: "development", APP_ORIGIN: "http://127.0.0.1:3100" };
  expect(nativePlaybackEnabled(env, "darwin")).toBe(true);
  expect(nativePlaybackEnabled(env, "linux")).toBe(false);
  for (const override of [
    { NODE_ENV: "production" },
    { APP_ORIGIN: "https://example.com" },
    { APP_ORIGIN: "bad" },
    { PERSONA_SPEECH_ACCEPTANCE: "false" },
    { PERSONA_SPEECH_ACCEPTANCE: "invalid" },
  ])
    expect(nativePlaybackEnabled({ ...env, ...override }, "darwin")).toBe(
      false,
    );
});
