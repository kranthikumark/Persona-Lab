import { localeAvailable } from "@/lib/localization/release";
import { localizedContent } from "@/lib/localization/content";
import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, hash } from "@/lib/api";
import { reserveBudget } from "@/lib/release/limits";
import {
  DEFAULT_PREFERENCES,
  PreferenceSchema,
  StartPracticeSchema,
  SettingsSchema,
  effectiveSettings,
  type Preferences,
  type PracticeSettings,
} from "./metadata";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function localizationContent(definition: {
  title: string;
  objectives: readonly string[];
  character: { persona: string };
  approvedFacts: readonly { id: string; title: string; detail: string }[];
  constraints: readonly string[];
}) {
  return {
    title: definition.title,
    instructions: definition.objectives,
    persona: definition.character.persona,
    approvedFacts: definition.approvedFacts,
    constraints: definition.constraints,
  };
}
export async function ensureEnglishLocalization(
  scenarioId: string,
  content: Prisma.InputJsonValue,
) {
  const where = {
    scenarioId_locale_version: { scenarioId, locale: "en-IN", version: 1 },
  };
  const existing = await db.scenarioLocalization.findUnique({ where });
  if (existing) return existing;
  try {
    return await db.scenarioLocalization.create({
      data: {
        scenarioId,
        locale: "en-IN",
        version: 1,
        status: "baseline",
        content,
      },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    )
      throw error;
    return db.scenarioLocalization.findUniqueOrThrow({ where });
  }
}
export async function preferenceView(ownerHash: string | null) {
  const record = ownerHash
    ? await db.practicePreference.findUnique({ where: { ownerHash } })
    : null;
  const saved = !!record && record.expiresAt > new Date();
  return {
    preferences: saved
      ? PreferenceSchema.parse(record.settings)
      : { ...DEFAULT_PREFERENCES },
    saved,
  };
}
export async function readPreferences(
  ownerHash: string | null,
): Promise<Preferences> {
  return (await preferenceView(ownerHash)).preferences;
}
export async function clearPreferences(ownerHash: string | null) {
  if (ownerHash)
    await db.practicePreference.deleteMany({ where: { ownerHash } });
  return { preferences: { ...DEFAULT_PREFERENCES }, saved: false };
}
function mergePreferences(current: Preferences, input: unknown) {
  const options = StartPracticeSchema.parse(input);
  return PreferenceSchema.parse({
    ...current,
    ...options,
    ...(options.practiceLocale && !options.characterLocale
      ? { characterLocale: options.practiceLocale }
      : {}),
  });
}
export async function savePreferences(ownerHash: string, input: unknown) {
  const settings = mergePreferences(await readPreferences(ownerHash), input);
  assertLocaleSettings(settings);
  await reserveBudget([
    { key: `preferences:owner:${ownerHash}`, limit: 30, windowSeconds: 60 },
    { key: "preferences:global", limit: 300, windowSeconds: 3600 },
  ]);
  const data = { settings, expiresAt: new Date(Date.now() + 30 * 86400000) };
  await db.practicePreference.upsert({
    where: { ownerHash },
    create: { ownerHash, ...data },
    update: data,
  });
  return settings;
}
export async function newSettings(
  ownerHash: string,
  input: unknown,
  scenarioId: string,
  content: Prisma.InputJsonValue,
): Promise<PracticeSettings> {
  const preferences = mergePreferences(await readPreferences(ownerHash), input);
  assertLocaleSettings(preferences);
  const localized =
    preferences.practiceLocale === "en-IN"
      ? content
      : nativeLocalizationContent(preferences.practiceLocale);
  const localization =
    preferences.practiceLocale === "en-IN"
      ? await ensureEnglishLocalization(scenarioId, content)
      : await ensureDraftLocalization(
          scenarioId,
          preferences.practiceLocale,
          localized,
        );
  if (
    !["baseline", "draft"].includes(localization.status) ||
    stable(localization.content) !== stable(localized)
  )
    throw new ApiError(
      422,
      "The scenario localization does not match its approved baseline.",
    );
  return SettingsSchema.parse({
    ...preferences,
    version: "practice-settings-v1",
    localization: {
      id: localization.id,
      locale: preferences.practiceLocale,
      version: 1,
      contentHash: hash(stable(localized)),
      source:
        preferences.practiceLocale === "en-IN"
          ? "versioned_baseline"
          : "versioned_draft",
    },
  });
}
export function branchSettings(
  session: unknown,
  branch: unknown,
): PracticeSettings {
  const settings = effectiveSettings(session),
    selected = effectiveSettings(branch);
  if (
    settings.practiceLocale !== settings.characterLocale ||
    settings.localization.locale !== settings.practiceLocale ||
    stable(settings) !== stable(selected)
  )
    throw new ApiError(
      422,
      "This branch has incompatible practice settings. No changes were made.",
    );
  return selected;
}

export async function verifyLocalization(
  settings: PracticeSettings,
  scenarioId: string,
  content: Prisma.InputJsonValue,
  presentation?: import("@/lib/localization/content").LocalePresentation,
) {
  const reference = settings.localization;
  if (reference.source === "embedded_legacy") {
    if (reference.id !== null || reference.contentHash !== null)
      throw new ApiError(422, "The legacy localization reference is invalid.");
    return;
  }
  if (!reference.id || !reference.contentHash)
    throw new ApiError(422, "The localization reference is incomplete.");
  const record = await db.scenarioLocalization.findUnique({
    where: { id: reference.id },
  });
  if (
    !record ||
    record.scenarioId !== scenarioId ||
    record.locale !== reference.locale ||
    record.version !== reference.version ||
    !["baseline", "draft"].includes(record.status) ||
    hash(stable(record.content)) !== reference.contentHash ||
    stable(record.content) !==
      stable(
        settings.practiceLocale === "en-IN"
          ? content
          : nativeLocalizationContent(
              settings.practiceLocale,
              presentation,
              reference.version,
            ),
      )
  )
    throw new ApiError(
      422,
      "The saved localization is incompatible with this practice.",
    );
}

export function assertLocaleSettings(settings: Preferences) {
  if (
    !localeAvailable(settings.practiceLocale, process.env) ||
    settings.characterLocale !== settings.practiceLocale
  )
    throw new ApiError(
      422,
      "This practice language is awaiting review and release verification. English text remains available.",
    );
}
export function nativeLocalizationContent(
  locale: "hi-IN" | "te-IN",
  presentation?: import("@/lib/localization/content").LocalePresentation,
  version = 1,
) {
  const content = presentation ?? localizedContent[locale];
  return {
    title: content.title,
    instructions: content.objectives,
    persona: content.persona,
    approvedFacts: content.facts,
    opening: content.opening,
    revision: `insurance-${locale}-v${version}-draft`,
  } as unknown as Prisma.InputJsonValue;
}
async function ensureDraftLocalization(
  scenarioId: string,
  locale: "hi-IN" | "te-IN",
  content: Prisma.InputJsonValue,
) {
  const where = {
    scenarioId_locale_version: { scenarioId, locale, version: 1 },
  };
  const existing = await db.scenarioLocalization.findUnique({ where });
  if (existing) return existing;
  try {
    return await db.scenarioLocalization.create({
      data: { scenarioId, locale, version: 1, status: "draft", content },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    )
      throw error;
    return db.scenarioLocalization.findUniqueOrThrow({ where });
  }
}
