import { effectiveSettings } from "@/lib/practice/metadata";
import "server-only";
import { positiveSummary } from "@/lib/evaluation/presentation";
import { createEvaluation, savedEvaluation } from "@/lib/evaluation/service";
import { historyFor, requireBranch } from "@/lib/simulation/service";
import type { EvaluationReport } from "@/lib/evaluation/rubric";
import type { PracticeLocale } from "@/lib/localization/content";
import { localizedContent } from "@/lib/localization/content";
import { nativeCopy } from "./localized-copy";

export type ExportCheck = {
  achievement: string;
  label: string;
  status: "demonstrated" | "concern" | "insufficient";
  guidance: string;
  evidence: { turn: number; scope: string; excerpt: string }[];
};
export type ReportDocument = {
  locale?: PracticeLocale;
  corrections?: {
    label: string;
    earlierTurns: number[];
    correctedTurns: number[];
  }[];
  title: string;
  approach: string;
  createdAt: string;
  revision: number;
  turns: number;
  forkTurn: number | null;
  score: number;
  coverage: number;
  totalChecks: number;
  length: { turn: number; wordCount: number; status: string }[] | null;
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
  const locale = "analysisLocale" in report ? report.analysisLocale : "en-IN";
  const copy = nativeCopy(locale);
  const gap =
    report.categories
      .flatMap((c) => c.checks)
      .find((c) => c.status === "concern") ??
    report.categories
      .flatMap((c) => c.checks)
      .find((c) => c.status === "insufficient");
  const checkCopy = (id: string) =>
    copy?.checks[id as keyof typeof copy.checks];
  return {
    locale,
    corrections:
      "corrections" in report
        ? report.corrections.map((c) => ({
            label: checkCopy(c.checkId)?.[0] ?? c.checkId,
            earlierTurns: c.earlierTurns,
            correctedTurns: c.correctedTurns,
          }))
        : undefined,
    title: localizedContent[locale].title,
    approach,
    createdAt,
    revision: report.scope.revision,
    turns: report.scope.throughTurn,
    forkTurn: report.scope.forkTurn,
    score: report.overall ?? 0,
    coverage: report.assessedChecks,
    totalChecks: report.totalChecks,
    length:
      "length" in report
        ? report.length.map(({ turn, wordCount, status }) => ({
            turn,
            wordCount,
            status,
          }))
        : null,
    rubric: report.rubricVersion,
    nextAction: copy
      ? gap
        ? (checkCopy(gap.id)?.[2] ?? report.nextAction)
        : copy.limitNote
      : report.nextAction,
    categories: report.categories.map((c, i) => ({
      label: copy?.categories[i] ?? c.label,
      weight: c.weight,
      score: c.score ?? 0,
      checks: c.checks.map((check) => ({
        label: checkCopy(check.id)?.[0] ?? check.label,
        achievement:
          checkCopy(check.id)?.[1] ?? positiveSummary(check.id, check.label),
        status: check.status,
        guidance:
          copy && check.status === "concern"
            ? `${checkCopy(check.id)?.[2] ?? ""} (${check.feedback})`
            : (checkCopy(check.id)?.[2] ?? check.feedback),
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
  reportId?: string,
) {
  const { branch, session } = await requireBranch(branchId, owner);
  if (
    effectiveSettings(session.settings).practiceLocale !== "en-IN" &&
    !(await import("@/lib/localization/release")).acceptancePreview(process.env)
  )
    throw new (await import("@/lib/api")).ApiError(
      422,
      "This language is available only in localhost acceptance preview while fluent-speaker review is pending.",
    );
  const saved = reportId
    ? await savedEvaluation(branchId, owner, reportId)
    : await createEvaluation(branchId, owner, revision);
  if (saved.report.scope.revision !== revision || saved.stale)
    throw new (await import("@/lib/api")).ApiError(
      409,
      "This report is outdated. Evaluate the current revision before exporting.",
    );
  const history = await historyFor(branchId);
  // Bound evidence to the evaluated revision even if another tab adds a turn.
  const data = reportDocument(
    saved.report,
    branch.name,
    saved.createdAt,
    history.messages,
  );
  if (data.locale === "en-IN") {
    const pinned = session.scenarioData as {
      title?: string;
      localizedPresentation?: { title?: string };
    };
    data.title =
      pinned.localizedPresentation?.title ?? pinned.title ?? data.title;
  }
  return data;
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
