import { z } from "zod";
import * as v3 from "./v3-rubric";
import * as v4 from "./v4-rubric";
import {
  evaluationCues,
  pinnedFactConflicts,
} from "@/lib/localization/evaluation-rules";
import { lengthRecord } from "@/lib/response-length";
import type { PracticeLocale } from "@/lib/localization/content";
export type { EvaluationHistory } from "./legacy-rubric";
export const RUBRIC_VERSION = v3.RUBRIC_VERSION;
export const ENGINE_VERSION = v3.ENGINE_VERSION;
export const LEGACY_LOCALIZED_RUBRIC = v4.LOCALIZED_RUBRIC;
export const LOCALIZED_RUBRIC = "insurance-rubric-v5";
const LocalizedSchema = v3.ReportSchema.options[0].extend({
  rubricVersion: z.literal(LOCALIZED_RUBRIC),
  engineVersion: z.literal("localized-quality-v2"),
  analysisLocale: z.enum(["hi-IN", "te-IN"]),
  feedbackLocale: z.literal("en-IN"),
  analysisMethod: z.literal("sentence-localized-phrases-v2"),
  corrections: z.array(
    z.object({
      checkId: z.string(),
      earlierTurns: z.array(z.number()),
      correctedTurns: z.array(z.number()),
    }),
  ),
});
export const ReportSchema = z.union([
  LocalizedSchema,
  ...v4.ReportSchema.options,
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
      content: evaluationCues(m.content, locale),
    })),
  };
  const report = v3.evaluate(normalized, scope);
  const conflicts = history.messages
    .filter((m) => m.role === "user")
    .map((m) => ({
      message: m,
      reasons: pinnedFactConflicts(m.content, locale),
    }))
    .filter((m) => m.reasons.length);
  if (conflicts.length) {
    const category = report.categories.find((c) => c.id === "accuracy")!;
    const check = category.checks.find((c) => c.id === "approved-terms")!;
    const earlierConcerns = check.status === "concern" ? check.evidence : [];
    check.status = "concern";
    check.feedback =
      [...new Set(conflicts.flatMap((c) => c.reasons))].join(" ") +
      " Later corrections are shown separately; the full-history score retains earlier contradictions.";
    const factEvidence = conflicts.map(({ message: m }) => {
      const event = history.events.find(
        (e) =>
          e.turn === m.turn &&
          (e.payload as { messageId?: string })?.messageId === m.id,
      );
      if (!event)
        throw new Error("Evaluation evidence is missing its recorded event.");
      return {
        messageId: m.id,
        eventId: event.id,
        turn: m.turn,
        scope:
          scope.forkTurn === null
            ? ("original" as const)
            : m.turn <= scope.forkTurn
              ? ("shared" as const)
              : ("after_fork" as const),
      };
    });
    check.evidence = [
      ...new Map(
        [...earlierConcerns, ...factEvidence].map((e) => [e.messageId, e]),
      ).values(),
    ].sort((a, b) => a.turn - b.turn);
    category.score =
      (category.checks.filter((c) => c.status === "demonstrated").length /
        category.checks.length) *
      100;
    report.overall = Math.round(
      report.categories.reduce(
        (sum, c) => sum + ((c.score ?? 0) * c.weight) / 100,
        0,
      ),
    );
    report.assessedChecks = report.categories
      .flatMap((c) => c.checks)
      .filter((c) => c.status !== "insufficient").length;
    report.nextAction = check.feedback;
  }
  // Corrections are visible; earlier observed contradictions are not erased or
  // silently rescored. References still point to original messages and events.
  const corrections: z.infer<typeof LocalizedSchema>["corrections"] = [];
  for (const category of report.categories)
    for (const check of category.checks) {
      if (check.status !== "concern") continue;
      const lastConcern = Math.max(...check.evidence.map((e) => e.turn));
      const after = {
        ...normalized,
        messages: normalized.messages.filter((m) => m.turn > lastConcern),
        events: normalized.events.filter((e) => e.turn > lastConcern),
      };
      const later = v3
        .evaluate(after, scope)
        .categories.flatMap((c) => c.checks)
        .find((c) => c.id === check.id);
      if (later?.status === "demonstrated")
        corrections.push({
          checkId: check.id,
          earlierTurns: check.evidence.map((e) => e.turn),
          correctedTurns: later.evidence.map((e) => e.turn),
        });
    }
  return LocalizedSchema.parse({
    ...report,
    rubricVersion: LOCALIZED_RUBRIC,
    engineVersion: "localized-quality-v2",
    analysisLocale: locale,
    feedbackLocale: "en-IN",
    analysisMethod: "sentence-localized-phrases-v2",
    corrections,
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
  if (report.rubricVersion !== LOCALIZED_RUBRIC)
    return v4.validateEvidence(report, history, scope);
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
  return v4.evaluateVersion(version, history, scope, locale);
}
