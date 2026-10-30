import { z } from "zod";
import { SpeechConsentSchema } from "@/lib/speech/contracts";

export const LocaleSchema = z.enum(["en-IN", "hi-IN", "te-IN"]);
export const localeRegistry = [
  {
    locale: "en-IN",
    name: "English (India)",
    contentStatus: "baseline",
    textImplementation: "verified",
  },
  {
    locale: "hi-IN",
    name: "हिन्दी",
    contentStatus: "draft_pending_native_review",
    textImplementation: "automated_and_live_checks_passed",
  },
  {
    locale: "te-IN",
    name: "తెలుగు",
    contentStatus: "draft_pending_native_review",
    textImplementation: "automated_and_live_checks_passed",
  },
] as const;
const preferenceFields = {
  interfaceLocale: z.literal("en-IN"),
  practiceLocale: LocaleSchema,
  characterLocale: LocaleSchema,
  coachingLocale: z.literal("en-IN"),
  mode: z.literal("text"),
  codeSwitchPolicy: z.literal("preserve_original_with_english_coaching"),
};
export const PreferenceSchema = z.object(preferenceFields).strict();
export const StartPracticeSchema = PreferenceSchema.partial();
export const SessionStartSchema = StartPracticeSchema.extend({
  scenarioId: z.string().min(1).max(100).optional(),
});
export type Preferences = z.infer<typeof PreferenceSchema>;
export const DEFAULT_PREFERENCES: Preferences = {
  interfaceLocale: "en-IN",
  practiceLocale: "en-IN",
  characterLocale: "en-IN",
  coachingLocale: "en-IN",
  mode: "text",
  codeSwitchPolicy: "preserve_original_with_english_coaching",
};
export const CatalogSchema = z
  .object({
    version: z.literal("scenario-catalog-v1"),
    audience: z.enum(["PERSONAL", "BUSINESS", "BOTH"]),
    skillGoals: z.array(z.string().min(1)).min(1),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]),
    traineeRole: z.string().min(1),
    supportedModalities: z.array(z.enum(["text", "voice", "video"])).min(1),
  })
  .strict();
export const DEFAULT_CATALOG = CatalogSchema.parse({
  version: "scenario-catalog-v1",
  audience: "BUSINESS",
  skillGoals: [
    "Needs discovery",
    "Factual explanation",
    "Handling objections",
    "Unpressured next steps",
  ],
  difficulty: "intermediate",
  traineeRole: "Fictional insurance advisor",
  supportedModalities: ["text"],
});
export const LocalizationRefSchema = z
  .object({
    id: z.string().nullable(),
    locale: LocaleSchema,
    version: z.number().int().positive(),
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    source: z.enum([
      "versioned_baseline",
      "versioned_draft",
      "embedded_legacy",
    ]),
  })
  .strict();
export const SettingsSchema = PreferenceSchema.extend({
  version: z.literal("practice-settings-v1"),
  localization: LocalizationRefSchema,
}).strict();
export type PracticeSettings = z.infer<typeof SettingsSchema>;
export const LEGACY_SETTINGS: PracticeSettings = {
  ...DEFAULT_PREFERENCES,
  version: "practice-settings-v1",
  localization: {
    id: null,
    locale: "en-IN",
    version: 1,
    contentHash: null,
    source: "embedded_legacy",
  },
};
export function effectiveSettings(value: unknown): PracticeSettings {
  return value === null || value === undefined
    ? structuredClone(LEGACY_SETTINGS)
    : SettingsSchema.parse(value);
}
export const TranslationSchema = z
  .object({
    locale: LocaleSchema,
    text: z.string().min(1).max(12000),
    label: z.literal("Translation"),
    method: z.enum(["human", "machine"]),
    version: z.number().int().positive(),
    reviewStatus: z.enum(["draft", "reviewed"]),
    reviewedBy: z.string().min(1).nullable(),
  })
  .strict()
  .refine(
    (t) => t.reviewStatus !== "reviewed" || t.reviewedBy !== null,
    "Reviewed translations require review provenance.",
  );
export const MessageSourceSchema = z
  .object({
    version: z.literal("message-source-v1"),
    modality: z.enum(["text", "voice", "video"]),
    originalLocale: LocaleSchema,
    originalText: z.string().max(12000),
    provenance: z.enum(["typed", "scenario", "model", "confirmed_transcript"]),
    translations: z.array(TranslationSchema),
    transcript: z
      .object({
        provider: z.string().min(1),
        confirmedByUser: z.boolean(),
        model: z.string().optional(),
        rawText: z.string().max(2000).optional(),
        audioDurationMs: z.number().finite().nonnegative().optional(),
        receiptId: z.uuid().optional(),
        consent: SpeechConsentSchema.optional(),
      })
      .strict()
      .nullable(),
    consentId: z.string().min(1).nullable(),
  })
  .strict()
  .refine(
    (m) =>
      m.modality === "text"
        ? m.transcript === null &&
          m.consentId === null &&
          m.provenance !== "confirmed_transcript"
        : m.provenance === "confirmed_transcript" &&
          m.transcript?.confirmedByUser === true &&
          m.consentId !== null,
    "Media input requires a confirmed transcript and consent reference.",
  );
export type MessageSource = z.infer<typeof MessageSourceSchema>;
export function textSource(
  content: string,
  locale: z.infer<typeof LocaleSchema>,
  provenance: "typed" | "scenario" | "model",
): MessageSource {
  return MessageSourceSchema.parse({
    version: "message-source-v1",
    modality: "text",
    originalLocale: locale,
    originalText: content,
    provenance,
    translations: [],
    transcript: null,
    consentId: null,
  });
}
export function effectiveMessageSource(
  value: unknown,
  content: string,
  locale: z.infer<typeof LocaleSchema>,
  provenance: "typed" | "scenario" | "model",
) {
  const source =
    value == null
      ? textSource(content, locale, provenance)
      : MessageSourceSchema.parse(value);
  if (source.originalText !== content)
    throw new Error("Original message source does not match stored content.");
  return source;
}
export const EvaluationLocalesSchema = z
  .object({
    version: z.literal("evaluation-locales-v1"),
    practiceLocale: LocaleSchema,
    rubricLocale: LocaleSchema,
    feedbackLocale: z.literal("en-IN"),
    localization: LocalizationRefSchema,
  })
  .strict();
export const evaluationLocales = (settings: PracticeSettings) =>
  EvaluationLocalesSchema.parse({
    version: "evaluation-locales-v1",
    practiceLocale: settings.practiceLocale,
    rubricLocale: settings.practiceLocale,
    feedbackLocale: settings.coachingLocale,
    localization: settings.localization,
  });
export const ConsentSchema = z
  .object({
    version: z.literal("media-consent-v1"),
    id: z.string().min(1),
    status: z.enum(["granted", "revoked"]),
    purposes: z
      .array(
        z.enum(["speech_transcription", "source_authoring", "camera_coaching"]),
      )
      .min(1),
    recordedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict()
  .refine(
    (c) => Date.parse(c.expiresAt) > Date.parse(c.recordedAt),
    "Consent expiry must follow recording time.",
  );
// Contracts only. No upload, media capture, storage or analysis endpoint is enabled.
export const MediaProvenanceSchema = z
  .object({
    version: z.literal("private-media-source-v1"),
    kind: z.enum(["audio", "video", "image", "document"]),
    ownerScope: z.literal("browser"),
    privateStorageKey: z.string().regex(/^[a-zA-Z0-9_/-]+$/),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    originalLocale: LocaleSchema.nullable(),
    consent: ConsentSchema,
    analysisStatus: z.enum(["not_requested", "blocked"]),
    deleteAfter: z.iso.datetime(),
  })
  .strict()
  .refine(
    (m) =>
      Date.parse(m.deleteAfter) <= Date.parse(m.consent.expiresAt) &&
      Date.parse(m.deleteAfter) > Date.parse(m.consent.recordedAt) &&
      (m.consent.status === "granted" || m.analysisStatus === "blocked"),
    "Media retention/analysis must respect consent.",
  );
