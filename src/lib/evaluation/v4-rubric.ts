import { z } from "zod";
import * as v3 from "./v3-rubric";
import { canonicalForRules } from "@/lib/localization/rules";
import { lengthRecord } from "@/lib/response-length";
import type { PracticeLocale } from "@/lib/localization/content";
export type { EvaluationHistory } from "./legacy-rubric";
export const RUBRIC_VERSION = v3.RUBRIC_VERSION;
export const ENGINE_VERSION = v3.ENGINE_VERSION;
export const LOCALIZED_RUBRIC = "insurance-rubric-v4";
const LocalizedSchema = v3.ReportSchema.options[0].extend({
  rubricVersion: z.literal(LOCALIZED_RUBRIC),
  engineVersion: z.literal("localized-quality-v1"),
  analysisLocale: z.enum(["hi-IN", "te-IN"]),
  feedbackLocale: z.literal("en-IN"),
  analysisMethod: z.literal("bounded-localized-phrases-v1"),
});
export const ReportSchema = z.union([
  LocalizedSchema,
  ...v3.ReportSchema.options,
]);
export type EvaluationReport = z.infer<typeof ReportSchema>;
export const evaluate = v3.evaluate;
export function evaluateLocalized(
  history: v3.EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
  locale: Exclude<PracticeLocale, "en-IN">,
): EvaluationReport {
  const normalized = {
    ...history,
    messages: history.messages.map((m) => ({
      ...m,
      content: canonicalForRules(m.content, locale),
    })),
  };
  const report = v3.evaluate(normalized, scope);
  return LocalizedSchema.parse({
    ...report,
    rubricVersion: LOCALIZED_RUBRIC,
    engineVersion: "localized-quality-v1",
    analysisLocale: locale,
    feedbackLocale: "en-IN",
    analysisMethod: "bounded-localized-phrases-v1",
    length: history.messages
      .filter((m) => m.role === "user")
      .map((m) => ({ messageId: m.id, turn: m.turn, ...lengthRecord(m) })),
  });
}
export function validateEvidence(
  value: unknown,
  history: v3.EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
) {
  const report = ReportSchema.parse(value);
  if (!("analysisLocale" in report))
    return v3.validateEvidence(report, history, scope);
  const expected = evaluateLocalized(history, scope, report.analysisLocale);
  if (JSON.stringify(report) !== JSON.stringify(expected))
    throw new Error(
      "Evaluation evidence or scope does not match the recorded history.",
    );
  return report;
}
export function evaluateVersion(
  version: string,
  history: v3.EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
  locale: PracticeLocale = "en-IN",
) {
  if (version === LOCALIZED_RUBRIC) {
    if (locale === "en-IN")
      throw new Error("Localized rubric requires its pinned locale.");
    return evaluateLocalized(history, scope, locale);
  }
  return v3.evaluateVersion(version, history, scope);
}
