import { speechCapabilities } from "@/lib/speech/capabilities";
import { languageReadiness } from "@/lib/localization/release";
import { localeRegistry } from "@/lib/practice/metadata";
import { capabilities } from "@/lib/capabilities/server";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(
    {
      version: 1,
      speech: speechCapabilities(),
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
