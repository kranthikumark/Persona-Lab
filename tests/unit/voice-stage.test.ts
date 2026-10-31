import { expect, it } from "vitest";
import { voiceStage } from "@/lib/speech/voice-stage";
it("capture and generation suppress stale playback presentation; queued audio is not speaking", () => {
  expect(voiceStage("permission", false, "speaking")).toBe("permission");
  expect(voiceStage("recording", false, "speaking")).toBe("listening");
  expect(voiceStage("transcribing", false, "speaking")).toBe("transcribing");
  expect(voiceStage("idle", true, "speaking")).toBe("thinking");
  expect(voiceStage("idle", false, "preparing")).toBe("preparing");
  expect(voiceStage("idle", false, "speaking")).toBe("speaking");
  expect(voiceStage("idle", false, "idle")).toBe("ready");
});
