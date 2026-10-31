import { simliConfig } from "@/lib/avatar/simli";
import { nativePlaybackVoices } from "@/lib/speech/native-playback";
import { speechCapabilities } from "@/lib/speech/capabilities";
import { languageReadiness } from "@/lib/localization/release";
import { localeRegistry } from "@/lib/practice/metadata";
import { capabilities } from "@/lib/capabilities/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      version: 1,
      avatar: {
        provider: "simli",
        configured: simliConfig().configured,
        customFace: simliConfig().customFace,
        previewSeconds: simliConfig().previewSeconds,
      },
      speech: {
        ...speechCapabilities(),
        nativePlayback: {
          provider: "installed_mac_voice",
          retention: "temporary_generated_wav_deleted_before_response",
          voices: await nativePlaybackVoices(),
        },
      },
      capabilities: capabilities(),
      locales: localeRegistry.map((locale) => ({
        ...locale,
        readiness: languageReadiness[locale.locale],
        textAvailable: (locale.locale === "en-IN"
          ? capabilities().englishText
          : locale.locale === "hi-IN"
            ? capabilities().hindiText
            : capabilities().teluguText
        ).available,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
