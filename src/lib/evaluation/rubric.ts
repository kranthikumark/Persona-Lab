import { z } from "zod";
import {
  evaluate as evaluateLegacy,
  ReportSchema as LegacyReportSchema,
  type EvaluationHistory,
} from "./legacy-rubric";
export type { EvaluationHistory } from "./legacy-rubric";

export const RUBRIC_VERSION = "insurance-rubric-v2";
export const ENGINE_VERSION = "practice-report-v2";
const CurrentReportSchema = LegacyReportSchema.extend({
  rubricVersion: z.literal(RUBRIC_VERSION),
  engineVersion: z.literal(ENGINE_VERSION),
  categories: z
    .array(
      LegacyReportSchema.shape.categories.element.extend({
        score: z.number().min(0).max(100),
      }),
    )
    .length(5),
  overall: z.number().min(0).max(100),
});
export const ReportSchema = z.union([CurrentReportSchema, LegacyReportSchema]);
export type EvaluationReport = z.infer<typeof ReportSchema>;

// Versioned, bounded language checks. Missing matches are gaps in recorded
// evidence, not proof that a person lacks a skill or that a policy is compliant.
const expanded: Record<string, RegExp> = {
  "claim-boundaries":
    /\b(?:claim|coverage|approval|reimbursement)s?\b[^.!?\n]{0,100}\b(?:depends? on|subject to|may qualify|may be covered|not guaranteed|never guaranteed)\b|\bapproval\b[^.!?\n]{0,30}\bdepends? on\b/i,
  "experience-question":
    /\b(?:past|previous|prior)\b[^.!?\n]{0,35}\b(?:experience|claims?|insurance)\b|\b(?:biggest|main) concern\b|\bwhat\b[^.!?\n]{0,45}\b(?:concerns|worries) you\b/i,
  acknowledgement:
    /\bi understand\b[^.!?\n]{0,70}\b(?:skeptical|cautious|concern|worr|feel)\w*\b|\b(?:valid|understandable) concern\b|\bwould (?:naturally )?make you (?:cautious|skeptical|worried)\b/i,
};

export function evaluate(
  history: EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
): EvaluationReport {
  const original = evaluateLegacy(history, scope);
  const users = history.messages.filter((m) => m.role === "user");
  const categories = original.categories.map((category) => {
    const checks = category.checks.map((check) => {
      const rule = expanded[check.id];
      if (!rule || check.status !== "insufficient") return check;
      const supported = users.filter(
        (m) =>
          rule.test(m.content) &&
          (check.id !== "experience-question" || m.content.includes("?")),
      );
      if (!supported.length) return check;
      return {
        ...check,
        status: "demonstrated" as const,
        evidence: supported.map((m) => {
          const event = history.events.find(
            (e) =>
              e.turn === m.turn &&
              (e.payload as { messageId?: string } | null)?.messageId === m.id,
          );
          if (!event)
            throw new Error(
              "Evaluation evidence is missing its recorded event.",
            );
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
        }),
      };
    });
    return {
      ...category,
      checks,
      score: checks.filter((c) => c.status === "demonstrated").length * 50,
    };
  });
  const checks = categories.flatMap((c) => c.checks);
  const gap =
    checks.find((c) => c.status === "concern") ??
    checks.find((c) => c.status === "insufficient");
  return CurrentReportSchema.parse({
    ...original,
    rubricVersion: RUBRIC_VERSION,
    engineVersion: ENGINE_VERSION,
    categories,
    overall: Math.round(
      categories.reduce((sum, c) => sum + (c.score * c.weight) / 100, 0),
    ),
    assessedChecks: checks.filter((c) => c.status !== "insufficient").length,
    nextAction: !users.length
      ? "Start with one response to Priya. Your report card will build from the conversation you record."
      : gap
        ? gap.feedback
        : "Try a shorter alternative response and compare how the conversation changes. The rubric is complete, but it is not a measure of real-world competence.",
  });
}

export function validateEvidence(
  value: unknown,
  history: EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
) {
  const report = ReportSchema.parse(value);
  const expected =
    report.engineVersion === "phrase-evaluation-v1"
      ? evaluateLegacy(history, scope)
      : evaluate(history, scope);
  if (JSON.stringify(report) !== JSON.stringify(expected))
    throw new Error(
      "Evaluation evidence or scope does not match the recorded history.",
    );
  return report;
}
