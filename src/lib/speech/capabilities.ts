import "server-only";
import { acceptancePreview } from "@/lib/localization/release";
import { SPEECH_MODEL } from "./contracts";
function localSpeechPreview(env: Record<string, string | undefined>) {
  try {
    const origin = new URL(env.APP_ORIGIN ?? "http://127.0.0.1:3100");
    return (
      env.NODE_ENV !== "production" &&
      [undefined, "true"].includes(env.PERSONA_SPEECH_ACCEPTANCE) &&
      ["http:", "https:"].includes(origin.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    );
  } catch {
    return false;
  }
}
export function speechLocaleAvailable(
  locale: string,
  env: Record<string, string | undefined> = process.env,
) {
  return (
    !!env.META_API_KEY?.trim() &&
    localSpeechPreview(env) &&
    (locale === "en-IN" ||
      (["hi-IN", "te-IN"].includes(locale) && acceptancePreview(env)))
  );
}
export function speechCapabilities(
  env: Record<string, string | undefined> = process.env,
) {
  const configured = !!env.META_API_KEY?.trim();
  const preview = localSpeechPreview(env);
  return {
    provider: "meta",
    model: SPEECH_MODEL,
    configured,
    checkAvailable: configured && preview,
    dictationAvailable: configured && preview,
    releaseStatus: "localhost_accepted_english_microphone_and_device_playback",
    locales: [
      {
        locale: "en-IN",
        transcription:
          configured && preview ? "acceptance_preview" : "unavailable",
        liveAccess: "synthetic_fixture_verified",
        humanMicrophone: "user_reported_pass",
      },
      {
        locale: "hi-IN",
        transcription: speechLocaleAvailable("hi-IN", env)
          ? "acceptance_preview"
          : "not_verified",
        liveAccess: "public_read_speech_fixture_verified",
        humanMicrophone: "pending",
      },
      {
        locale: "te-IN",
        transcription: speechLocaleAvailable("te-IN", env)
          ? "acceptance_preview"
          : "not_verified",
        liveAccess: "public_read_speech_fixture_verified",
        humanMicrophone: "pending",
      },
    ],
    streaming: { providerDocumented: true, applicationVerified: false },
    playback: {
      providerTts: false,
      deviceLocalVoices: "runtime_dependent",
      automaticPlayback: "opt_in_device_local_voice",
      englishAudiblePlayback: "user_reported_pass",
    },
    audioRetention: "application_memory_only",
    camera: false,
    fullVoiceConversation: false,
  };
}
