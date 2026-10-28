import "server-only";
import { positiveSummary } from "@/lib/evaluation/presentation";
import { createEvaluation } from "@/lib/evaluation/service";
import { historyFor, requireBranch } from "@/lib/simulation/service";
import type { EvaluationReport } from "@/lib/evaluation/rubric";

export type ExportCheck = {
  achievement: string;
  label: string;
  status: "demonstrated" | "concern" | "insufficient";
  guidance: string;
  evidence: { turn: number; scope: string; excerpt: string }[];
};
export type ReportDocument = {
  title: string;
  approach: string;
  createdAt: string;
  revision: number;
  turns: number;
  forkTurn: number | null;
  score: number;
  coverage: number;
  rubric: string;
  categories: {
    label: string;
    weight: number;
    score: number;
    checks: ExportCheck[];
  }[];
  nextAction: string;
};
export function reportDocument(
  report: EvaluationReport,
  approach: string,
  createdAt: string,
  messages: { id: string; content: string }[],
): ReportDocument {
  return {
    title: "The trust conversation",
    approach,
    createdAt,
    revision: report.scope.revision,
    turns: report.scope.throughTurn,
    forkTurn: report.scope.forkTurn,
    score: report.overall ?? 0,
    coverage: report.assessedChecks,
    rubric: report.rubricVersion,
    nextAction: report.nextAction,
    categories: report.categories.map((c) => ({
      label: c.label,
      weight: c.weight,
      score: c.score ?? 0,
      checks: c.checks.map((check) => ({
        label: check.label,
        achievement: positiveSummary(check.id, check.label),
        status: check.status,
        guidance: check.feedback,
        evidence: check.evidence.slice(0, 1).map((e) => ({
          turn: e.turn,
          scope:
            e.scope === "shared"
              ? "Shared history"
              : e.scope === "after_fork"
                ? "After fork"
                : "Original path",
          excerpt: evidenceExcerpt(
            messages.find((m) => m.id === e.messageId)?.content ?? "",
            check.id,
          ),
        })),
      })),
    })),
  };
}
export async function exportData(
  branchId: string,
  owner: string | null,
  revision: number,
) {
  const { branch } = await requireBranch(branchId, owner);
  const saved = await createEvaluation(branchId, owner, revision);
  const history = await historyFor(branchId);
  // Bound evidence to the evaluated revision even if another tab adds a turn.
  return reportDocument(
    saved.report,
    branch.name,
    saved.createdAt,
    history.messages,
  );
}
export const reportLimitations =
  "This practice score uses a limited English phrase rubric. Demonstrated checks earn points; concerns and checks without recognized evidence earn zero. Missing matches do not prove a lack of skill. The score does not establish complete accuracy, empathy, compliance or real-world competence.";
export const statusLabel = (status: ExportCheck["status"]) =>
  status === "demonstrated"
    ? "Demonstrated"
    : status === "concern"
      ? "Observed concern"
      : "No recognized evidence yet";

function evidenceExcerpt(raw: string, id: string) {
  const text = raw.replace(/\s+/g, " ").replace(/\*\*/g, "").trim();
  if (text.length <= 260) return text;
  const anchors: Record<string, RegExp> = {
    "claim-boundaries":
      /claims? (?:are |is )?(?:reviewed|assessed)|approval|subject to|may qualify|may be covered/i,
    "approved-terms": /30[- ]day|24[- ]month|cosmetic procedures/i,
    "budget-question": /budget|afford|monthly cost/i,
    "experience-question":
      /previous|past experience|biggest concern|main concern|why[^.!?]{0,40}(?:concern|worr)/i,
    acknowledgement: /understand|valid concern|cautious|skeptical/i,
    "limits-explained": /30[- ]day|24[- ]month|cosmetic procedures/i,
    "collaborative-language": /may I|would you like|could we|can we/i,
    "review-offer": /review|summary|send|share/i,
    "unpressured-choice":
      /take your time|no need to decide|review before|would you like|may I send/i,
  };
  const match = anchors[id]?.exec(text);
  let start = Math.max(0, (match?.index ?? 0) - 65);
  if (start > 0) {
    const space = text.indexOf(" ", start);
    if (space !== -1) start = space + 1;
  }
  let end = Math.min(text.length, start + 250);
  if (end < text.length) {
    const space = text.lastIndexOf(" ", end);
    if (space > start) end = space;
  }
  return `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
