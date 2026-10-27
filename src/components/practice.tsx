"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CornerUpLeft,
  Flag,
  GitBranch,
  LoaderCircle,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Shell } from "./shell";
import { Button } from "./ui/button";
import { Drawer } from "./ui/drawer";
import { Facts } from "./studio";
import { api, type SessionView } from "@/lib/client";
import { publicScenario as scenario } from "@/lib/scenarios/public";

export function Practice({ sessionId }: { sessionId: string }) {
  const search = useSearchParams();
  const branchId = search.get("branch");
  return (
    <PracticeSession
      key={`${sessionId}:${branchId}`}
      sessionId={sessionId}
      branchId={branchId}
    />
  );
}
function subscribeDraft(callback: () => void) {
  window.addEventListener("persona-draft", callback);
  return () => window.removeEventListener("persona-draft", callback);
}
function PracticeSession({
  sessionId,
  branchId,
}: {
  sessionId: string;
  branchId: string | null;
}) {
  const router = useRouter();
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"facts" | "coach" | null>(null);
  const [decision, setDecision] = useState<number | null>(null);
  const [branchName, setBranchName] = useState("A different approach");
  const bottom = useRef<HTMLDivElement>(null);
  const pending = useRef<{ text: string; key: string } | null>(null);
  const storageKey = `persona-draft:${sessionId}:${branchId ?? "original"}`;
  const draft = useSyncExternalStore(
    subscribeDraft,
    () => sessionStorage.getItem(storageKey) ?? "",
    () => "",
  );
  const load = useCallback(async () => {
    try {
      const result = await api<SessionView>(
        `/api/sessions/${sessionId}${branchId ? `?branch=${encodeURIComponent(branchId)}` : ""}`,
      );
      setError("");
      setView(result);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [sessionId, branchId]);
  useEffect(() => {
    let active = true;
    api<SessionView>(
      `/api/sessions/${sessionId}${branchId ? `?branch=${encodeURIComponent(branchId)}` : ""}`,
    )
      .then((result) => {
        if (active) {
          setError("");
          setView(result);
        }
      })
      .catch((error: Error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [sessionId, branchId]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant", block: "nearest" });
  }, [view?.messages.length, busy]);
  function updateDraft(value: string) {
    sessionStorage.setItem(storageKey, value);
    window.dispatchEvent(new Event("persona-draft"));
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!view || !draft.trim() || busy) return;
    setBusy(true);
    setError("");
    const text = draft.trim();
    if (pending.current?.text !== text)
      pending.current = { text, key: crypto.randomUUID() };
    try {
      const next = await api<SessionView>(
        `/api/branches/${view.branch.id}/turns`,
        { ...pending.current, revision: view.branch.revision },
      );
      setView(next);
      updateDraft("");
      pending.current = null;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function fork() {
    if (!view || decision === null) return;
    const snapshot = view.snapshots.find((s) => s.turnNumber === decision);
    if (!snapshot) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ branchId: string }>(
        `/api/branches/${view.branch.id}/forks`,
        { snapshotId: snapshot.id, name: branchName },
      );
      setDecision(null);
      router.push(`/sessions/${sessionId}?branch=${result.branchId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const originalDecision = view?.messages.find(
    (m) => m.role === "user" && m.turn === (decision ?? -1) + 1,
  );
  const selectedSnapshot = view?.snapshots.find(
    (s) => s.turnNumber === decision,
  );
  return (
    <Shell page="Practice workspace" mode={view?.provider}>
      <main className="practice-main">
        <div className="practice-heading">
          <div>
            <Link className="back-link" href="/">
              <ArrowLeft size={15} /> Scenario studio
            </Link>
            <h1>The trust conversation</h1>
            <p>A careful customer. An honest conversation.</p>
          </div>
          <div className="practice-heading-actions">
            <Button variant="secondary" onClick={() => setPanel("facts")}>
              <BookOpen size={16} /> Policy brief
            </Button>
            {view && view.branches.length > 1 && (
              <Link
                className="button button-primary"
                href={`/sessions/${sessionId}/compare?left=${view.branches[0].id}&right=${view.branch.parentBranchId ? view.branch.id : view.branches.at(-1)!.id}`}
              >
                <GitBranch size={16} /> Compare paths
              </Link>
            )}
          </div>
        </div>
        {!view ? (
          <div className="empty-state">
            {error ? (
              <>
                <h2>Let’s reconnect.</h2>
                <p role="alert">{error}</p>
                <Button onClick={load}>Try again</Button>
              </>
            ) : (
              <>
                <LoaderCircle size={28} className="spin" />
                <p>Preparing your practice space…</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="session-toolbar">
              <span
                className={`pill ${view.branch.parentBranchId ? "mint-pill" : "violet"}`}
              >
                <GitBranch size={14} />
                {view.branch.parentBranchId
                  ? "Alternative path"
                  : "Original path"}
              </span>
              <label className="branch-select">
                <span className="sr-only">Current approach</span>
                <select
                  aria-label="Current approach"
                  value={view.branch.id}
                  disabled={busy}
                  onChange={(e) =>
                    router.push(
                      `/sessions/${sessionId}?branch=${e.target.value}`,
                    )
                  }
                >
                  {view.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <span className="turn-count">
                {view.snapshots.at(-1)?.turnNumber ?? 0} decisions made
              </span>
              <Button
                className="coach-trigger"
                variant="ghost"
                size="sm"
                onClick={() => setPanel("coach")}
              >
                <Sparkles size={15} /> Field notes{" "}
                {view.findings.length > 0 && (
                  <span className="issue-count">{view.findings.length}</span>
                )}
              </Button>
            </div>
            <div className="practice-grid">
              <aside className="character-panel">
                <div className="character-photo">
                  <Image
                    src="/images/priya.webp"
                    alt="Priya, your fictional conversation partner"
                    fill
                    sizes="250px"
                    priority
                  />
                  <div className="portrait-shade" />
                  <div>
                    <span className="eyebrow">YOUR COUNTERPART</span>
                    <h2>Priya</h2>
                    <p>Prospective customer</p>
                  </div>
                </div>
                <div className="character-body">
                  <span className="pill neutral">Thoughtful & skeptical</span>
                  <p>
                    Looking for clarity about coverage, exclusions, and whether
                    she can trust your explanation.
                  </p>
                  <div className="character-divider" />
                  <span className="eyebrow">YOUR OBJECTIVE</span>
                  <h3>
                    Earn trust.
                    <br />
                    Keep it honest.
                  </h3>
                  <ul className="session-objectives">
                    {scenario.objectives.map((objective) => (
                      <li key={objective}>
                        <span />
                        {objective}
                      </li>
                    ))}
                  </ul>
                  <div className="character-divider" />
                  <div className="state-heading">
                    <span className="eyebrow">SIMULATED STATE</span>
                    <ShieldCheck size={14} />
                  </div>
                  <StateIndicators state={view.state} />
                  <span className="state-disclaimer">
                    Scenario indicators, not psychological measurements.
                  </span>
                </div>
              </aside>
              <section className="conversation-panel" aria-label="Conversation">
                <div className="conversation-top">
                  <div>
                    <span className="presence-dot" />
                    <strong>In conversation with Priya</strong>
                  </div>
                  <span>
                    {view.provider === "mock"
                      ? "Scripted mock"
                      : "Meta Muse Spark"}
                  </span>
                </div>
                <div
                  className="conversation-scroll"
                  role="log"
                  aria-live="polite"
                  aria-label="Conversation transcript"
                >
                  <div className="conversation-start">
                    <span />
                    <small>YOUR PRACTICE BEGINS HERE</small>
                    <span />
                  </div>
                  {view.branch.parentBranchId && (
                    <div className="branch-notice">
                      <GitBranch size={14} /> A new possibility. Your original
                      conversation is saved.
                    </div>
                  )}
                  {view.messages.map((message) => (
                    <div
                      id={`message-${message.id}`}
                      className={`message-row ${message.role === "user" ? "from-user" : "from-priya"}`}
                      key={message.id}
                    >
                      <div className="message-avatar">
                        {message.role === "user" ? "Y" : "P"}
                      </div>
                      <div className="message-main">
                        <div className="message-label">
                          <strong>
                            {message.role === "user" ? "You" : "Priya"}
                          </strong>
                          <span>
                            {message.turn === 0
                              ? "Opening"
                              : `Turn ${message.turn}`}
                            {message.inherited ? " · Shared history" : ""}
                          </span>
                        </div>
                        <div className="message-bubble">{message.content}</div>
                        {message.role === "user" && (
                          <button
                            className="message-rewind"
                            onClick={() => {
                              setBranchName(
                                `Alternative ${view.branches.length}`,
                              );
                              setDecision(message.turn - 1);
                            }}
                            disabled={busy}
                          >
                            <CornerUpLeft size={12} /> Try another response
                          </button>
                        )}
                        {view.findings.some(
                          (f) => f.messageId === message.id,
                        ) && (
                          <button
                            className="message-flag"
                            onClick={() => setPanel("coach")}
                          >
                            <Flag size={12} /> Policy guarantee flagged
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {busy && decision === null && (
                    <div className="thinking" role="status">
                      <span />
                      <span />
                      <span />
                      {view.provider === "mock"
                        ? "Preparing Priya's response…"
                        : "Priya is considering your response…"}
                    </div>
                  )}
                  <div ref={bottom} />
                </div>
                <form className="composer-area" onSubmit={send}>
                  {error && (
                    <div className="error-banner" role="alert">
                      {error}
                      <button type="button" onClick={load}>
                        Reload conversation
                      </button>
                    </div>
                  )}
                  <div className="composer-box">
                    <label className="sr-only" htmlFor="response">
                      Your response to Priya
                    </label>
                    <textarea
                      id="response"
                      placeholder="What would you say to Priya?"
                      value={draft}
                      onChange={(e) => updateDraft(e.target.value)}
                      maxLength={2000}
                      rows={3}
                      disabled={busy}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          e.currentTarget.form?.requestSubmit();
                        }
                      }}
                    />
                    <div className="composer-bottom">
                      <span>
                        <ShieldCheck size={12} /> A safe place to try
                      </span>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={busy || !draft.trim()}
                      >
                        {busy ? (
                          <LoaderCircle size={14} className="spin" />
                        ) : (
                          <Send size={14} />
                        )}{" "}
                        Send response
                      </Button>
                    </div>
                  </div>
                  <div className="composer-hint">
                    <span>
                      Enter to send <span className="footer-dot">·</span> Shift
                      + Enter for a new line
                    </span>
                    <span>{draft.length}/2000</span>
                  </div>
                </form>
              </section>
              <aside className="timeline-panel">
                <div className="timeline-heading">
                  <GitBranch size={18} />
                  <h2>Decision timeline</h2>
                </div>
                <p className="timeline-intro">
                  Every response is a moment you can revisit.
                </p>
                <div className="timeline-list">
                  {view.snapshots.map((snapshot) => {
                    const message = view.messages.find(
                      (m) =>
                        m.role === "user" && m.turn === snapshot.turnNumber,
                    );
                    return (
                      <button
                        className={`timeline-item ${snapshot.turnNumber === view.snapshots.at(-1)?.turnNumber ? "current" : ""}`}
                        key={snapshot.id}
                        onClick={() => {
                          setBranchName(`Alternative ${view.branches.length}`);
                          setDecision(snapshot.turnNumber);
                        }}
                        disabled={busy}
                      >
                        <span className="timeline-dot">
                          {snapshot.turnNumber === 0 ? (
                            <MessageSquare size={11} />
                          ) : (
                            snapshot.turnNumber
                          )}
                        </span>
                        <span>
                          <strong>
                            {snapshot.turnNumber === 0
                              ? "The starting point"
                              : `Decision ${String(snapshot.turnNumber).padStart(2, "0")}`}
                          </strong>
                          <small>
                            {message?.content ?? "Priya shares her concern"}
                          </small>
                          <em>
                            {snapshot.turnNumber ===
                            view.snapshots.at(-1)?.turnNumber
                              ? "Current saved state"
                              : "Explore from here"}
                          </em>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="timeline-tip">
                  <CornerUpLeft size={18} />
                  <strong>What if you tried another way?</strong>
                  <p>
                    Select a saved state to start a new path. Your original
                    stays exactly as it is.
                  </p>
                </div>
                <span className="timeline-footnote">
                  New responses create new simulated possibilities. They don’t
                  predict real people.
                </span>
              </aside>
            </div>
          </>
        )}
      </main>
      <Drawer
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
        title={
          panel === "facts"
            ? "The fictional policy"
            : "Notes on this conversation"
        }
        description={
          panel === "facts"
            ? "Use only these approved facts. Be clear about the limits and never promise claim approval."
            : "Early coaching uses a narrow deterministic check for guarantee phrases. Full rubric scoring is planned; these notes are not a complete assessment."
        }
      >
        {panel === "facts" ? (
          <Facts />
        ) : (
          <div className="coaching-list">
            {view?.findings.length ? (
              view.findings.map((finding) => (
                <div className="coaching-card" key={finding.messageId}>
                  <Flag size={18} />
                  <span className="eyebrow">
                    TURN {finding.turn} / POLICY ACCURACY
                  </span>
                  <h3>{finding.title}</h3>
                  <p>{finding.detail}</p>
                  <blockquote>
                    {
                      view.messages.find((m) => m.id === finding.messageId)
                        ?.content
                    }
                  </blockquote>
                  <a
                    href={`#message-${finding.messageId}`}
                    onClick={() => setPanel(null)}
                  >
                    View exact message <ArrowRight size={14} />
                  </a>
                  <small>{finding.source}</small>
                </div>
              ))
            ) : (
              <div className="coaching-card">
                <ShieldCheck size={22} />
                <h3>No guarantee phrase flagged.</h3>
                <p>
                  This phrase check cannot establish that every statement is
                  accurate. Keep referring to the approved policy facts.
                </p>
              </div>
            )}
            <div className="coaching-card neutral-card">
              <h3>Try a different opening.</h3>
              <p>
                Ask what worries Priya before explaining the policy. Use the
                timeline to explore another response and compare the
                conversations.
              </p>
            </div>
          </div>
        )}
      </Drawer>
      <Drawer
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
        title="One moment. Another possibility."
        description={`Start a new branch from the saved state after ${decision === 0 ? "Priya's opening" : `decision ${decision}`}. Your original conversation will stay intact.`}
      >
        <div className="fork-preview">
          <span className="eyebrow">
            {originalDecision
              ? "THE RESPONSE YOU CAN REVISIT"
              : "CONTINUE FROM THIS SAVED STATE"}
          </span>
          {originalDecision ? (
            <blockquote>{originalDecision.content}</blockquote>
          ) : (
            <p>
              Try a different direction from the selected decision boundary.
            </p>
          )}
          {selectedSnapshot && (
            <StateIndicators state={selectedSnapshot.state} />
          )}
          <label className="field-label" htmlFor="branch-name">
            Name this approach
          </label>
          <input
            id="branch-name"
            value={branchName}
            maxLength={60}
            onChange={(e) => setBranchName(e.target.value)}
          />
          <div className="fork-explanation">
            <Check size={16} />
            <p>
              Same scenario. Same starting state.
              <br />A new response, with room for a different outcome.
            </p>
          </div>
          {error && (
            <p className="error-banner" role="alert">
              {error}
            </p>
          )}
          <Button onClick={fork} disabled={busy || !branchName.trim()}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <GitBranch size={16} />
            )}{" "}
            Create alternative path <ArrowRight size={16} />
          </Button>
        </div>
      </Drawer>
    </Shell>
  );
}

export function StateIndicators({ state }: { state: SessionView["state"] }) {
  return (
    <div className="state-indicators">
      <div>
        <span>Customer confidence</span>
        <strong className={state.trust >= 50 ? "mint" : ""}>
          {state.trust >= 65
            ? "Growing"
            : state.trust >= 40
              ? "Opening up"
              : state.trust >= 25
                ? "Cautious"
                : "Low"}
        </strong>
        <i>
          <b style={{ width: `${state.trust}%` }} />
        </i>
      </div>
      <div>
        <span>Conversation stage</span>
        <strong>
          {state.phase === "discovery"
            ? "Discovery"
            : state.phase === "clarification"
              ? "Clarification"
              : "Next step"}
        </strong>
      </div>
      <div>
        <span>Guarantee flags</span>
        <strong className={state.violations ? "amber" : "mint"}>
          {state.violations || "None flagged"}
        </strong>
      </div>
    </div>
  );
}
