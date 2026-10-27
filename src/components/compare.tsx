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

export function Compare({ sessionId }: { sessionId: string }) {
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
  let prefix = 0;
  if (views) {
    while (
      prefix < Math.min(views[0].messages.length, views[1].messages.length) &&
      views[0].messages[prefix].id === views[1].messages[prefix].id
    )
      prefix++;
  }
  return (
    <Shell page="Compare possibilities" mode={views?.[0].provider}>
      <main className="compare-main">
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
          </div>
        ) : !views ? (
          <div className="empty-state">
            <LoaderCircle className="spin" />
            <p>Aligning your conversations…</p>
          </div>
        ) : (
          <>
            <div className="comparison-note">
              <ShieldCheck size={17} />
              <span>
                These are simulated possibilities. Differences describe recorded
                conversations, not proven real-world effects.
              </span>
            </div>
            <div className="shared-history">
              <Button
                variant="ghost"
                onClick={() => setSharedOpen(!sharedOpen)}
              >
                <GitBranch size={16} />
                {prefix} shared messages before the paths diverge{" "}
                <span>{sharedOpen ? "Hide" : "View"}</span>
              </Button>
              {sharedOpen && (
                <div>
                  {views[0].messages.slice(0, prefix).map((m) => (
                    <p key={m.id}>
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
                        router.push(`/sessions/${sessionId}/compare?${next}`);
                      }}
                    >
                      {view.branches.map((b) => (
                        <option key={b.id} value={b.id}>
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
                          id={`compare-${message.id}`}
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
                          <p>{finding.detail}</p>
                          <blockquote>
                            {
                              view.messages.find(
                                (m) => m.id === finding.messageId,
                              )?.content
                            }
                          </blockquote>
                          <small>
                            Evidence: turn {finding.turn} · {finding.messageId}
                          </small>
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
                  <Link
                    className="button button-secondary"
                    href={`/sessions/${sessionId}?branch=${view.branch.id}`}
                  >
                    Continue this path <ArrowRight size={15} />
                  </Link>
                </section>
              ))}
            </div>
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
