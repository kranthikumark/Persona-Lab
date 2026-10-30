import { expect, it } from "vitest";
import { selectLocalVoice } from "@/lib/speech/playback";
it("selects an installed matching language, preferring the exact region; never remote or English for Telugu", () => {
  const voices = [
    { lang: "en-US", localService: true },
    { lang: "te-IN", localService: false },
    { lang: "hi_IN", localService: true },
    { lang: "en-IN", localService: true },
  ];
  expect(selectLocalVoice(voices, "te-IN")).toBeUndefined();
  expect(selectLocalVoice(voices, "hi-IN")).toBe(voices[2]);
  expect(selectLocalVoice(voices, "en-IN")).toBe(voices[3]);
});
