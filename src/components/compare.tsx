"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  GitBranch,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { api, type SessionView } from "@/lib/client";
import { Shell } from "./shell";
import { Button } from "./ui/button";
import { StateIndicators } from "./practice";
import { EvaluationPanel } from "./evaluation";
import { comparePaths, type turnRecord } from "@/lib/simulation/comparison";

export function Compare({ sessionId }: { sessionId: string }) {
  const search = useSearchParams();
  return (
    <CompareSession
      key={`${sessionId}:${search.get("left")}:${search.get("right")}`}
      sessionId={sessionId}
    />
  );
}
function CompareSession({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const leftId = search.get("left");
  const rightId = search.get("right");
  const [views, setViews] = useState<[SessionView, SessionView] | null>(null);
  const [error, setError] = useState("");
  const [sharedOpen, setSharedOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const base = await api<SessionView>(`/api/sessions/${sessionId}`);
        if (base.branches.length < 2)
          throw new Error(
            "Create an alternative path before comparing conversations.",
          );
        const ids = [
          leftId ?? base.branches[0].id,
          rightId ?? base.branches.at(-1)!.id,
        ];
        const result = await Promise.all(
          ids.map((id) =>
            api<SessionView>(
              `/api/sessions/${sessionId}?branch=${encodeURIComponent(id)}`,
            ),
          ),
        );
        if (!cancelled) setViews(result as [SessionView, SessionView]);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId, leftId, rightId]);
  const comparison = views ? comparePaths(views[0], views[1]) : null;
  const prefix = comparison?.prefix ?? 0;
  return (
    <Shell page="Compare possibilities" mode={views?.[0].provider}>
      <main className="compare-main" id="page-content" tabIndex={-1}>
        <Link className="back-link" href={`/sessions/${sessionId}`}>
          <ArrowLeft size={15} /> Back to practice
        </Link>
        <div className="compare-heading">
          <span className="eyebrow mint">SAME MOMENT. DIFFERENT CHOICES.</span>
          <h1>
            See what changes<span>.</span>
          </h1>
          <p>Two conversations. A shared starting point. More room to learn.</p>
        </div>
        {error ? (
          <div className="error-banner" role="alert">
            {error}
            <Link
              href={`/sessions/${sessionId}`}
              className="error-recovery-link"
            >
              Return to practice <ArrowRight size={14} />
            </Link>
          </div>
        ) : !views ? (
          <div className="empty-state" role="status">
            <LoaderCircle className="spin" />
            <p>Aligning your conversations…</p>
          </div>
        ) : (
          <>
            <div className="comparison-note">
              <ShieldCheck size={17} />
              <span>
                These are simulated possibilities. Differences describe recorded
                conversations, not proven real-world effects. Opening this page
                replays saved records; it does not generate new dialogue.
              </span>
            </div>
            {comparison?.unequalLength && (
              <div className="comparison-note" role="note">
                These paths have different numbers of decisions. Final
                indicators describe different conversation lengths; compare
                matching turns below.
              </div>
            )}
            <div
              className="branch-split"
              aria-label="Both paths share the same recorded history before diverging"
            >
              <div className="split-origin">
                <GitBranch size={18} />
                <span>
                  Shared starting point
                  <small>
                    {prefix} recorded {prefix === 1 ? "message" : "messages"} in
                    common
                  </small>
                </span>
              </div>
              <div className="split-paths">
                <span className="split-path-a">
                  <i aria-hidden="true" />A · {views[0].branch.name}
                </span>
                <span className="split-path-b">
                  <i aria-hidden="true" />B · {views[1].branch.name}
                </span>
              </div>
            </div>
            {views[0].branch.id === views[1].branch.id && (
              <div className="comparison-note">
                Both selectors currently show the same approach. Choose another
                path to compare different decisions.
              </div>
            )}
            <div className="shared-history">
              <Button
                variant="ghost"
                onClick={() => setSharedOpen(!sharedOpen)}
                aria-expanded={sharedOpen}
                aria-controls="shared-transcript"
              >
                <GitBranch size={16} />
                {prefix} shared messages before the paths diverge{" "}
                <span>{sharedOpen ? "Hide" : "View"}</span>
              </Button>
              {sharedOpen && (
                <div id="shared-transcript">
                  {views[0].messages.slice(0, prefix).map((m) => (
                    <p key={m.id} id={`shared-${m.id}`}>
                      <strong>{m.role === "user" ? "You" : "Priya"}</strong>
                      {m.content}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="compare-grid">
              {views.map((view, index) => (
                <section
                  className={`compare-column ${index === 1 ? "alternative" : ""}`}
                  aria-label={`Path ${index === 0 ? "A" : "B"}: ${view.branch.name}`}
                  key={`${index}-${view.branch.id}`}
                >
                  <div className="compare-column-heading">
                    <span
                      className={`pill ${index === 0 ? "violet" : "mint-pill"}`}
                    >
                      <GitBranch size={13} />
                      {index === 0 ? "PATH A" : "PATH B"}
                    </span>
                    <h2>{view.branch.name}</h2>
                    <label
                      className="sr-only"
                      htmlFor={`compare-branch-${index}`}
                    >
                      Choose path {index === 0 ? "A" : "B"}
                    </label>
                    <select
                      id={`compare-branch-${index}`}
                      value={view.branch.id}
                      onChange={(e) => {
                        const next = new URLSearchParams(search.toString());
                        next.set(
                          index === 0 ? "left" : "right",
                          e.target.value,
                        );
                        router.push(`/sessions/${sessionId}/compare?${next}`, {
                          scroll: false,
                        });
                      }}
                    >
                      {view.branches.map((b) => (
                        <option
                          key={b.id}
                          value={b.id}
                          disabled={
                            b.id === views[index === 0 ? 1 : 0].branch.id &&
                            b.id !== view.branch.id
                          }
                        >
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <StateIndicators state={view.state} />
                  </div>
                  <div className="divergence-label">
                    <span />{" "}
                    {prefix === view.messages.length
                      ? "No new decisions after the shared history"
                      : "THE PATH FROM HERE"}
                    <span />
                  </div>
                  <div className="compare-transcript">
                    {view.messages.slice(prefix).length === 0 ? (
                      <div className="empty-comparison">
                        <GitBranch size={24} />
                        <p>This path is ready for a new response.</p>
                      </div>
                    ) : (
                      view.messages.slice(prefix).map((message) => (
                        <div
                          className={`comparison-message ${message.role === "user" ? "is-user" : ""}`}
                          id={`compare-${index}-${message.id}`}
                          key={message.id}
                        >
                          <span>
                            {message.role === "user" ? "YOU" : "PRIYA"} / TURN{" "}
                            {message.turn}
                          </span>
                          <p>{message.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="compare-coaching">
                    <span className="eyebrow">EVIDENCE / GUARANTEE CHECK</span>
                    {view.findings.length ? (
                      view.findings.map((finding) => (
                        <div key={finding.messageId}>
                          <h3>{finding.title}</h3>
                          <span className="finding-scope">
                            {view.messages
                              .slice(0, prefix)
                              .some((m) => m.id === finding.messageId)
                              ? "From shared history"
                              : "After the split"}
                          </span>
                          <p>{finding.detail}</p>
                          <blockquote>
                            {
                              view.messages.find(
                                (m) => m.id === finding.messageId,
                              )?.content
                            }
                          </blockquote>
                          <a
                            className="evidence-link"
                            href={
                              view.messages
                                .slice(0, prefix)
                                .some((m) => m.id === finding.messageId)
                                ? `#shared-${finding.messageId}`
                                : `#compare-${index}-${finding.messageId}`
                            }
                            onClick={() => {
                              if (
                                view.messages
                                  .slice(0, prefix)
                                  .some((m) => m.id === finding.messageId)
                              )
                                setSharedOpen(true);
                            }}
                          >
                            View evidence · turn {finding.turn}
                          </a>
                        </div>
                      ))
                    ) : (
                      <p>
                        No guarantee phrase flagged in this path. This is a
                        limited check, not a complete quality score.
                      </p>
                    )}
                    <div className="event-summary">
                      <span>{view.events.length} recorded turn events</span>
                      <span>
                        {view.messages.filter((m) => m.role === "user").length}{" "}
                        decisions
                      </span>
                    </div>
                  </div>
                  <details className="comparison-evaluation">
                    <summary>Rubric evaluation · {view.branch.name}</summary>
                    <EvaluationPanel
                      branchId={view.branch.id}
                      revision={view.branch.revision}
                      compact
                      evidenceHref={(id) =>
                        `/sessions/${sessionId}?branch=${view.branch.id}#message-${id}`
                      }
                    />
                  </details>
                  <Link
                    className="button button-secondary"
                    href={`/sessions/${sessionId}?branch=${view.branch.id}`}
                  >
                    Continue this path <ArrowRight size={15} />
                  </Link>
                </section>
              ))}
            </div>
            <section
              className="recorded-differences"
              aria-labelledby="differences-title"
            >
              <div className="differences-heading">
                <span className="eyebrow">
                  RECORDED STATE / AFTER THE SPLIT
                </span>
                <h2 id="differences-title">What changed at each turn</h2>
                <p>
                  Changes are calculated from each path’s saved before-and-after
                  states. Positive and negative values describe simulation
                  variables, not quality scores.
                </p>
              </div>
              {!comparison?.rows.length ? (
                <p className="empty-comparison">
                  No different decisions have been recorded yet.
                </p>
              ) : (
                comparison.rows.map((row) => (
                  <section
                    className="difference-row"
                    key={row.turn}
                    aria-label={`Recorded changes at turn ${row.turn}`}
                  >
                    <h3>Turn {row.turn}</h3>
                    <div className="difference-pair">
                      {row.paths.map((record, index) => (
                        <RecordedChange
                          key={index}
                          record={record}
                          index={index}
                          name={views[index].branch.name}
                        />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </section>
            <div className="comparison-bottom">
              <h3>Different words. A different possibility.</h3>
              <p>
                Look at the customer’s actual replies and policy accuracy. A
                higher simulated indicator doesn’t prove a better real-world
                outcome.
              </p>
            </div>
          </>
        )}
      </main>
    </Shell>
  );
}

function RecordedChange({
  record,
  index,
  name,
}: {
  record: ReturnType<typeof turnRecord>;
  index: number;
  name: string;
}) {
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  return (
    <div className={`recorded-change ${index === 1 ? "alternative" : ""}`}>
      <span className="change-path">
        Path {index === 0 ? "A" : "B"} · {name}
      </span>
      {!record ? (
        <p className="muted">No decision recorded at this turn.</p>
      ) : (
        <>
          <a
            className="evidence-link"
            href={`#compare-${index}-${record.user.id}`}
          >
            View response · turn {record.user.turn}
          </a>
          <p>
            {record.event?.type === "POLICY_GUARANTEE_FLAGGED"
              ? "Guarantee phrase flagged"
              : record.event
                ? "Turn committed"
                : "Event unavailable"}
          </p>
          {record.delta ? (
            <dl className="change-values">
              <div>
                <dt>Trust</dt>
                <dd>{signed(record.delta.trust)}</dd>
              </div>
              <div>
                <dt>Frustration</dt>
                <dd>{signed(record.delta.frustration)}</dd>
              </div>
              <div>
                <dt>Interest</dt>
                <dd>{signed(record.delta.interest)}</dd>
              </div>
              <div>
                <dt>Guarantee flags</dt>
                <dd>{signed(record.delta.violations)}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Saved state unavailable for this turn.</p>
          )}
        </>
      )}
    </div>
  );
}
