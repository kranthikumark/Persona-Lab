import { describe, expect, it } from "vitest";
import {
  CatalogSchema,
  DEFAULT_CATALOG,
  DEFAULT_PREFERENCES,
  LEGACY_SETTINGS,
  effectiveSettings,
  StartPracticeSchema,
  textSource,
  effectiveMessageSource,
  TranslationSchema,
  MediaProvenanceSchema,
  evaluationLocales,
} from "@/lib/practice/metadata";

describe("V5-04 locale and source contracts", () => {
  it("defaults legacy settings to English without mutating the shared baseline", () => {
    expect(effectiveSettings(null)).toEqual(LEGACY_SETTINGS);
    const first = effectiveSettings(null);
    first.localization.id = "changed";
    expect(effectiveSettings(null).localization.id).toBeNull();
    expect(DEFAULT_PREFERENCES.mode).toBe("text");
    expect(evaluationLocales(LEGACY_SETTINGS)).toMatchObject({
      practiceLocale: "en-IN",
      rubricLocale: "en-IN",
      feedbackLocale: "en-IN",
    });
    expect(CatalogSchema.parse(DEFAULT_CATALOG)).toMatchObject({
      audience: "BUSINESS",
      difficulty: "intermediate",
      supportedModalities: ["text"],
    });
  });
  it.each([
    { practiceLocale: "xx-IN" },
    { coachingLocale: "te-IN" },
    { characterLocale: "fr-FR" },
    { mode: "voice" },
    { localization: { id: "forged" } },
    { inputModality: "video" },
  ])("rejects unavailable or forged creation options %j", (options) => {
    expect(StartPracticeSchema.safeParse(options).success).toBe(false);
  });
  it("preserves exact original script and whitespace; translations cannot replace it", () => {
    const original = "  English हिन्दी తెలుగు 🙂  ";
    const source = textSource(original, "en-IN", "typed");
    expect(
      effectiveMessageSource(source, original, "en-IN", "typed").originalText,
    ).toBe(original);
    expect(source.translations).toEqual([]);
    expect(
      effectiveMessageSource(null, original, "en-IN", "typed").originalText,
    ).toBe(original);
    expect(() =>
      effectiveMessageSource(source, "rewritten", "en-IN", "typed"),
    ).toThrow();
    const draft = {
      locale: "hi-IN",
      text: "नमस्ते",
      label: "Translation",
      method: "machine",
      version: 1,
      reviewStatus: "draft",
      reviewedBy: null,
    };
    expect(TranslationSchema.safeParse(draft).success).toBe(true);
    expect(
      TranslationSchema.safeParse({ ...draft, reviewStatus: "reviewed" })
        .success,
    ).toBe(false);
  });
  it("requires consent, private provenance and bounded retention for future media contracts", () => {
    const source = {
      version: "private-media-source-v1",
      kind: "audio",
      ownerScope: "browser",
      privateStorageKey: "sources/opaque_key",
      sha256: "a".repeat(64),
      originalLocale: "en-IN",
      consent: {
        version: "media-consent-v1",
        id: "consent-1",
        status: "granted",
        purposes: ["speech_transcription"],
        recordedAt: "2026-10-29T00:00:00Z",
        expiresAt: "2026-10-30T00:00:00Z",
      },
      analysisStatus: "not_requested",
      deleteAfter: "2026-10-29T12:00:00Z",
    };
    expect(MediaProvenanceSchema.safeParse(source).success).toBe(true);
    expect(
      MediaProvenanceSchema.safeParse({
        ...source,
        privateStorageKey: "https://public.example/audio",
      }).success,
    ).toBe(false);
    expect(
      MediaProvenanceSchema.safeParse({ ...source, consent: null }).success,
    ).toBe(false);
    expect(
      MediaProvenanceSchema.safeParse({
        ...source,
        deleteAfter: "2026-11-01T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      MediaProvenanceSchema.safeParse({
        ...source,
        consent: { ...source.consent, status: "revoked" },
      }).success,
    ).toBe(false);
  });
});
