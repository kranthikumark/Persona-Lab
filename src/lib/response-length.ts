import { LocaleSchema } from "@/lib/practice/metadata";
import { z } from "zod";

export const WORD_LIMIT = 70;
export const CHARACTER_LIMIT = 2000;
export const COUNTING_VERSION = "lexical-whitespace-v1";
export const CONSTRAINT_VERSION = "response-70-v1";
// A whitespace-delimited token counts once if it contains a Unicode letter or
// number. Hyphens, apostrophes and punctuation inside that token do not split it.
// This deliberately avoids browser/server Intl.Segmenter/ICU differences.
export function countWords(text: string) {
  return text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token))
    .length;
}
export function responseLength(text: string) {
  const wordCount = countWords(text);
  const error =
    text.length > CHARACTER_LIMIT
      ? `Keep your response within ${CHARACTER_LIMIT} characters.`
      : wordCount === 0
        ? "Write at least one word before sending."
        : wordCount > WORD_LIMIT
          ? `Your response has ${wordCount} words. Remove ${wordCount - WORD_LIMIT} to stay within ${WORD_LIMIT}.`
          : null;
  return { wordCount, remaining: WORD_LIMIT - wordCount, error };
}
export const ValidationSchema = z
  .object({
    wordCount: z.number().int().min(1).max(WORD_LIMIT),
    locale: LocaleSchema,
    countingVersion: z.literal(COUNTING_VERSION),
    constraintVersion: z.literal(CONSTRAINT_VERSION),
    inputModality: z.enum(["text", "voice"]),
    status: z.literal("passed"),
  })
  .strict();
export type ResponseValidation = z.infer<typeof ValidationSchema>;
export function acceptedValidation(
  text: string,
  locale: import("@/lib/localization/content").PracticeLocale = "en-IN",
  inputModality: "text" | "voice" = "text",
): ResponseValidation {
  return ValidationSchema.parse({
    wordCount: countWords(text),
    locale,
    countingVersion: COUNTING_VERSION,
    constraintVersion: CONSTRAINT_VERSION,
    inputModality,
    status: "passed",
  });
}
export function lengthRecord(message: { content: string; metadata?: unknown }) {
  const metadata = message.metadata as
    { validation?: unknown } | null | undefined;
  const parsed = ValidationSchema.safeParse(metadata?.validation);
  return {
    wordCount: countWords(message.content),
    status: parsed.success
      ? ("passed" as const)
      : ("accepted_before_rule" as const),
    validation: parsed.success ? parsed.data : null,
  };
}
export const LengthRowSchema = z
  .object({
    messageId: z.string(),
    turn: z.number().int().positive(),
    wordCount: z.number().int().nonnegative(),
    status: z.enum(["passed", "accepted_before_rule"]),
    validation: ValidationSchema.nullable(),
  })
  .strict();
