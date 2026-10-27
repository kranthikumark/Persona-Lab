"use client";
import { useEffect, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import type { EvaluationReport } from "@/lib/evaluation/rubric";
import { Button } from "./ui/button";

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
      .then((result) => {
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
        Loading saved evaluation…
      </p>
    );
  const report = saved?.report;
  const stale = saved && (saved.stale || report?.scope.revision !== revision);
  return (
    <div className={`evaluation-panel ${compact ? "compact-evaluation" : ""}`}>
      <span className="eyebrow">EVIDENCE / FIVE-CATEGORY RUBRIC</span>
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
              ? "Check saved evaluation"
              : "Evaluate this path"}
      </Button>
      {!report ? (
        <p className="muted">
          Evaluate the recorded conversation with ten transparent phrase checks.
          No model request is made.
        </p>
      ) : (
        <>
          <div className="evaluation-overview">
            <span className="evaluation-number">
              {report.overall === null ? "—" : report.overall}
              <small>
                {report.overall === null
                  ? "Insufficient evidence for an overall score"
                  : "/ 100 · rule coverage score"}
              </small>
            </span>
            <p>
              {report.assessedChecks} / {report.totalChecks} checks assessed
            </p>
          </div>
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
            empathy or real-world outcomes. Missing evidence stays unscored.
          </p>
          <div className="evaluation-highlights">
            <h3>Strengths with evidence</h3>
            {report.categories
              .flatMap((category) => category.checks)
              .some((check) => check.status === "demonstrated") ? (
              <ul>
                {report.categories
                  .flatMap((category) => category.checks)
                  .filter((check) => check.status === "demonstrated")
                  .slice(0, 3)
                  .map((check) => (
                    <li key={check.id}>{check.label}</li>
                  ))}
              </ul>
            ) : (
              <p>No strengths assessed yet.</p>
            )}
            <h3>Areas to practice</h3>
            {report.categories
              .flatMap((category) => category.checks)
              .some((check) => check.status !== "demonstrated") ? (
              <ul>
                {report.categories
                  .flatMap((category) => category.checks)
                  .filter((check) => check.status !== "demonstrated")
                  .slice(0, 3)
                  .map((check) => (
                    <li key={check.id}>
                      {check.label} ·{" "}
                      {check.status === "concern"
                        ? "Needs review"
                        : "Insufficient evidence"}
                    </li>
                  ))}
              </ul>
            ) : (
              <p>
                All ten phrase checks have evidence. This does not establish
                complete conversation quality.
              </p>
            )}
          </div>
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
                  {category.score === null
                    ? "Insufficient evidence"
                    : `${category.score} / 100`}
                </strong>
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
                            : "Insufficient evidence"}
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
          A score requires both checks in each category. The overall score
          appears only when all ten checks have evidence; it is weighted 30 / 20
          / 20 / 15 / 15.
        </p>
      )}
    </div>
  );
}
