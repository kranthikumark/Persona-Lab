import { z } from "zod";
import * as legacy from "./legacy-rubric";
import * as v2 from "./v2-rubric";
import { lengthRecord, LengthRowSchema } from "@/lib/response-length";
export type { EvaluationHistory } from "./legacy-rubric";
export const RUBRIC_VERSION = "insurance-rubric-v3";
export const ENGINE_VERSION = "quality-report-v3";
const QualityReportSchema = v2.ReportSchema.options[0].extend({
  rubricVersion: z.literal(RUBRIC_VERSION),
  engineVersion: z.literal(ENGINE_VERSION),
  totalChecks: z.literal(9),
  assessedChecks: z.number().int().min(0).max(9),
  length: z.array(LengthRowSchema),
});
export const ReportSchema = z.union([
  QualityReportSchema,
  ...v2.ReportSchema.options,
]);
export type EvaluationReport = z.infer<typeof ReportSchema>;
export function evaluate(
  history: legacy.EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
): EvaluationReport {
  const original = v2.evaluate(history, scope);
  const categories = original.categories.map((category) => {
    const checks = category.checks.filter(
      (check) => check.id !== "concise-response",
    );
    return {
      ...category,
      checks,
      score: checks.length
        ? (checks.filter((check) => check.status === "demonstrated").length /
            checks.length) *
          100
        : 0,
    };
  });
  const checks = categories.flatMap((category) => category.checks);
  const users = history.messages.filter((m) => m.role === "user");
  const gap =
    checks.find((c) => c.status === "concern") ??
    checks.find((c) => c.status === "insufficient");
  return QualityReportSchema.parse({
    ...original,
    rubricVersion: RUBRIC_VERSION,
    engineVersion: ENGINE_VERSION,
    categories,
    totalChecks: checks.length,
    assessedChecks: checks.filter((c) => c.status !== "insufficient").length,
    overall: Math.round(
      categories.reduce(
        (sum, category) => sum + (category.score * category.weight) / 100,
        0,
      ),
    ),
    length: users.map((m) => ({
      messageId: m.id,
      turn: m.turn,
      ...lengthRecord(m),
    })),
    nextAction: !users.length
      ? "Start with one response to Priya. Your report card will build from the conversation you record."
      : (gap?.feedback ??
        "Try an alternative approach and compare the recorded evidence. This rubric is not a measure of real-world competence."),
  });
}
export function validateEvidence(
  value: unknown,
  history: legacy.EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
) {
  const report = ReportSchema.parse(value);
  const expected =
    report.engineVersion === legacy.ENGINE_VERSION
      ? legacy.evaluate(history, scope)
      : report.engineVersion === v2.ENGINE_VERSION
        ? v2.evaluate(history, scope)
        : evaluate(history, scope);
  if (JSON.stringify(report) !== JSON.stringify(expected))
    throw new Error(
      "Evaluation evidence or scope does not match the recorded history.",
    );
  return report;
}

export function evaluateVersion(
  version: string,
  history: legacy.EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
) {
  if (version === RUBRIC_VERSION) return evaluate(history, scope);
  if (version === v2.RUBRIC_VERSION) return v2.evaluate(history, scope);
  if (version === legacy.RUBRIC_VERSION) return legacy.evaluate(history, scope);
  throw new Error("Unsupported pinned evaluation version.");
}
