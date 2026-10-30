import type { PracticeLocale } from "./content";
export const languageReadiness = {
  "en-IN": {
    nativeReview: "baseline",
    software: "verified",
    exports: "verified",
  },
  "hi-IN": {
    nativeReview: "pending",
    software: "automated_and_live_checks_passed",
    exports: "local_chromium_and_libreoffice_verified",
  },
  "te-IN": {
    nativeReview: "pending",
    software: "automated_and_live_checks_passed",
    exports: "local_chromium_and_libreoffice_verified",
  },
} as const;
export function acceptancePreview(env: Record<string, string | undefined>) {
  try {
    return (
      env.NODE_ENV !== "production" &&
      env.PERSONA_LOCALE_ACCEPTANCE === "1" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(
        new URL(env.APP_ORIGIN ?? "http://127.0.0.1:3100").hostname,
      )
    );
  } catch {
    return false;
  }
}
export function localeAvailable(
  locale: PracticeLocale,
  env: Record<string, string | undefined>,
) {
  return locale === "en-IN" || acceptancePreview(env);
}
