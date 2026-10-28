"use client";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/client";
import type { EvaluationReport } from "@/lib/evaluation/rubric";
import { Button } from "./ui/button";
import { ReportActions } from "./report-actions";
import { positiveSummary } from "@/lib/evaluation/presentation";

export type SavedEvaluation = {
  id: string;
  createdAt: string;
  report: EvaluationReport;
  stale: boolean;
  currentRevision: number;
};
export function EvaluationPanel({
  branchId,
  revision,
  compact = false,
  evidenceHref,
  onEvidence,
}: {
  branchId: string;
  revision: number;
  compact?: boolean;
  evidenceHref: (id: string) => string;
  onEvidence?: (id: string) => void;
}) {
  const [saved, setSaved] = useState<SavedEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<SavedEvaluation | null>(`/api/branches/${branchId}/evaluation`)
      .then(async (result) => {
        // Opening Field notes creates a card even for a new or partial session.
        // Older reports remain stored; the new rubric writes its own version.
        if (!result || result.report.engineVersion === "phrase-evaluation-v1") {
          result = await api<SavedEvaluation>(
            `/api/branches/${branchId}/evaluation`,
            { revision },
          );
        }
        if (active) {
          setSaved(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError((e as Error).message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [branchId, revision]);
  async function run() {
    setBusy(true);
    setError("");
    try {
      setSaved(
        await api<SavedEvaluation>(`/api/branches/${branchId}/evaluation`, {
          revision,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <p role="status" className="muted">
        Preparing your report card…
      </p>
    );
  const report = saved?.report;
  const stale = saved && (saved.stale || report?.scope.revision !== revision);
  return (
    <div className={`evaluation-panel ${compact ? "compact-evaluation" : ""}`}>
      <div className="report-card-heading">
        <ClipboardList size={21} aria-hidden="true" />
        <div>
          <span className="eyebrow">YOUR PRACTICE</span>
          <h2>Session report card</h2>
        </div>
      </div>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      <Button variant="secondary" onClick={run} disabled={busy}>
        {busy ? (
          <LoaderCircle size={15} className="spin" />
        ) : (
          <Sparkles size={15} />
        )}
        {busy
          ? "Evaluating recorded evidence…"
          : stale
            ? "Evaluate current revision"
            : report
              ? "Refresh report card"
              : "Evaluate this path"}
      </Button>
      {!report ? (
        <p className="muted">
          Create a report card from your recorded conversation, with a score,
          positives, concerns and practical improvements. No model request is
          made.
        </p>
      ) : (
        <>
          <div className="evaluation-overview">
            <span className="evaluation-number">
              {report.overall ?? 0}
              <small>/ 100 · practice rubric score</small>
            </span>
            <p>
              {report.assessedChecks} / {report.totalChecks} checks with
              recognized evidence
            </p>
            <span className="report-readiness">
              {report.scope.throughTurn === 0
                ? "Not started · no responses yet"
                : report.assessedChecks < 10
                  ? "Provisional · evidence gaps remain"
                  : "Full rubric evidence coverage"}
            </span>
          </div>
          <ReportActions
            branchId={branchId}
            reportId={saved!.id}
            report={report}
            stale={Boolean(stale)}
          />
          <p className="report-scope">
            Revision {report.scope.revision} · through turn{" "}
            {report.scope.throughTurn} · full effective history
            {report.scope.forkTurn !== null
              ? ` · fork after turn ${report.scope.forkTurn}`
              : ""}
            <br />
            {report.rubricVersion} · {report.engineVersion}
          </p>
          {stale && (
            <p className="evaluation-stale" role="status">
              This report is outdated. The path is now at revision{" "}
              {saved.currentRevision}. Evaluate the current revision to include
              later turns.
            </p>
          )}
          <p className="evaluation-limits">
            These limited checks assess recorded phrases, not complete accuracy,
            empathy or real-world outcomes. Each demonstrated check earns
            points; concerns and checks without recognized evidence earn zero. A
            missing match may reflect limited wording recognition, not a lack of
            skill.
          </p>
          <div className="report-card-summary">
            <section
              className="report-card-section report-positives"
              aria-label="Positives"
            >
              <h3>
                <CheckCircle2 size={17} aria-hidden="true" /> Positives
              </h3>
              <h4>Strengths with evidence</h4>
              {report.categories
                .flatMap((c) => c.checks)
                .some((c) => c.status === "demonstrated") ? (
                <ul>
                  {report.categories
                    .flatMap((c) => c.checks)
                    .filter((c) => c.status === "demonstrated")
                    .map((check) => (
                      <li key={check.id}>
                        <strong>
                          {positiveSummary(check.id, check.label)}
                        </strong>
                        <ReportEvidence
                          check={check}
                          evidenceHref={evidenceHref}
                          onEvidence={onEvidence}
                        />
                      </li>
                    ))}
                </ul>
              ) : (
                <p>
                  No strengths evidenced yet. Record a response so this card can
                  highlight what you did well.
                </p>
              )}
            </section>
            <section
              className="report-card-section report-concerns"
              aria-label="Needs attention"
            >
              <h3>
                <CircleAlert size={17} aria-hidden="true" /> Needs attention
              </h3>
              {report.categories
                .flatMap((c) => c.checks)
                .some((c) => c.status === "concern") ? (
                <ul>
                  {report.categories
                    .flatMap((c) => c.checks)
                    .filter((c) => c.status === "concern")
                    .map((check) => (
                      <li key={check.id}>
                        <strong>{check.label}</strong>
                        <p>{check.feedback}</p>
                        <ReportEvidence
                          check={check}
                          evidenceHref={evidenceHref}
                          onEvidence={onEvidence}
                        />
                      </li>
                    ))}
                </ul>
              ) : (
                <p>
                  No negative findings matched the current rules. This does not
                  establish complete accuracy or conversation quality.
                </p>
              )}
            </section>
          </div>
          <section
            className="report-card-section report-improvements"
            aria-label="What to improve"
          >
            <h3>
              <TrendingUp size={17} aria-hidden="true" /> What to improve
            </h3>
            {report.categories
              .flatMap((c) => c.checks)
              .some((c) => c.status !== "demonstrated") ? (
              <ol>
                {report.categories
                  .flatMap((c) => c.checks)
                  .filter((c) => c.status !== "demonstrated")
                  .sort(
                    (a, b) =>
                      Number(b.status === "concern") -
                      Number(a.status === "concern"),
                  )
                  .map((check) => (
                    <li key={check.id}>
                      <strong>{check.label}</strong>
                      <span className="report-gap-label">
                        {check.status === "concern"
                          ? "Observed concern"
                          : "Not yet demonstrated by these rules"}
                      </span>
                      <p>{check.feedback}</p>
                    </li>
                  ))}
              </ol>
            ) : (
              <p>
                All rubric skills have supporting evidence. Try a shorter
                alternative response, respond to a different objection, or
                compare another path.
              </p>
            )}
          </section>
          <div className="evaluation-categories">
            {report.categories.map((category) => (
              <section
                className="evaluation-category"
                key={category.id}
                aria-label={category.label}
              >
                <div className="evaluation-category-heading">
                  <h3>{category.label}</h3>
                  <span>{category.weight}% weight</span>
                </div>
                <strong className="category-score">
                  {category.score ?? 0} / 100
                </strong>
                <div className="report-score-track" aria-hidden="true">
                  <span style={{ width: `${category.score ?? 0}%` }} />
                </div>
                <details open={!compact}>
                  <summary>Evidence and scoring rules</summary>
                  {category.checks.map((check) => (
                    <div
                      className={`evaluation-check check-${check.status}`}
                      key={check.id}
                    >
                      <h4>{check.label}</h4>
                      <span className="check-status">
                        {check.status === "demonstrated"
                          ? "Demonstrated by phrase rule"
                          : check.status === "concern"
                            ? "Needs review"
                            : "No recognized evidence yet"}
                      </span>
                      <p>{check.feedback}</p>
                      <div className="evaluation-evidence">
                        {check.evidence.map((evidence) => (
                          <a
                            key={evidence.messageId}
                            href={evidenceHref(evidence.messageId)}
                            onClick={
                              onEvidence
                                ? (event) => {
                                    event.preventDefault();
                                    onEvidence(evidence.messageId);
                                  }
                                : undefined
                            }
                          >
                            Turn {evidence.turn} ·{" "}
                            {evidence.scope === "shared"
                              ? "Shared history"
                              : evidence.scope === "after_fork"
                                ? "After fork"
                                : "Original path"}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </details>
              </section>
            ))}
          </div>
          <div className="evaluation-next">
            <h3>Next practice action</h3>
            <p>{report.nextAction}</p>
          </div>
        </>
      )}

      {report && (
        <p className="report-scope">
          Scores use fixed category weights of 30 / 20 / 20 / 15 / 15. Each
          category has two checks worth 50 points each. Checks without
          recognized evidence earn zero, so partial sessions still receive a
          score. Evidence coverage is displayed separately.
        </p>
      )}
    </div>
  );
}

function ReportEvidence({
  check,
  evidenceHref,
  onEvidence,
}: {
  check: EvaluationReport["categories"][number]["checks"][number];
  evidenceHref: (id: string) => string;
  onEvidence?: (id: string) => void;
}) {
  const evidence = check.evidence[0];
  if (!evidence) return null;
  return (
    <a
      className="report-evidence-link"
      href={evidenceHref(evidence.messageId)}
      onClick={
        onEvidence
          ? (event) => {
              event.preventDefault();
              onEvidence(evidence.messageId);
            }
          : undefined
      }
    >
      See turn {evidence.turn}
      {evidence.scope === "shared"
        ? " · shared history"
        : evidence.scope === "after_fork"
          ? " · after fork"
          : ""}
    </a>
  );
}
