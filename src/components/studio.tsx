"use client";
import { ScenarioLibrary } from "./scenario-library";
import { LanguageControls } from "./language-controls";
import {
  localizedContent,
  type PracticeLocale,
} from "@/lib/localization/content";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  GitBranch,
  LoaderCircle,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Shell } from "./shell";
import { Button } from "./ui/button";
import { Drawer } from "./ui/drawer";
import { api, type SessionSummary } from "@/lib/client";
import { publicScenario as scenario } from "@/lib/scenarios/public";

export function Studio({
  mode,
  textPracticeAvailable,
}: {
  mode: string;
  textPracticeAvailable: boolean;
}) {
  const search = useSearchParams();
  const historyOnly = search.get("view") === "history";
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [locale, setLocale] = useState<PracticeLocale>("en-IN");
  const localeRef = useRef<PracticeLocale>("en-IN");
  const selectLocale = useCallback((value: PracticeLocale) => {
    localeRef.current = value;
    setLocale(value);
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [facts, setFacts] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  useEffect(() => {
    api<{ sessions: SessionSummary[] }>("/api/sessions")
      .then((r) => setSessions(r.sessions))
      .catch((e) => setError(e.message))
      .finally(() => setSessionsLoading(false));
  }, []);
  async function refreshHistory() {
    setSessionsLoading(true);
    setError("");
    try {
      const result = await api<{ sessions: SessionSummary[] }>("/api/sessions");
      setSessions(result.sessions);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSessionsLoading(false);
    }
  }
  async function start(scenarioId?: string) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ sessionId: string }>("/api/sessions", {
        ...(scenarioId ? { scenarioId } : {}),
        practiceLocale: localeRef.current,
        characterLocale: localeRef.current,
      });
      // A new document applies the practice microphone Permissions-Policy.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/sessions/${result.sessionId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api(`/api/sessions/${id}`, undefined, "DELETE");
      setSessions((current) => current.filter((s) => s.id !== id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Shell
      page={historyOnly ? "Practice history" : "Scenario studio"}
      mode={mode}
    >
      <main className="studio-main" id="page-content" tabIndex={-1}>
        {historyOnly ? (
          <section className="studio-intro history-intro">
            <div>
              <span className="eyebrow accent-secondary">
                YOUR PERSONAL PRACTICE ARCHIVE
              </span>
              <h1>
                Every attempt.
                <br />
                <em>A new perspective.</em>
              </h1>
              <p className="intro-copy">
                Return to a conversation. Explore the decision you would make
                differently.
              </p>
            </div>
            <HistoryMark />
          </section>
        ) : (
          <section className="studio-hero" aria-labelledby="studio-title">
            <div className="studio-hero-copy">
              <span className="eyebrow accent-secondary">
                <span className="tiny-line" /> THE DECISION STUDIO
              </span>
              <h1 id="studio-title">
                Better conversations
                <br />
                begin with <em>practice.</em>
              </h1>
              <p>
                A little rehearsal for the moments that matter. Meet a
                character, make a decision, and discover what another response
                could change.
              </p>
              <div className="hero-actions">
                <Button
                  onClick={() => start()}
                  disabled={busy || !textPracticeAvailable}
                >
                  {busy ? (
                    <LoaderCircle size={17} className="spin" />
                  ) : (
                    <Sparkles size={17} />
                  )}
                  {!textPracticeAvailable
                    ? "Practice temporarily unavailable"
                    : busy
                      ? "Opening your studio…"
                      : "Begin practice"}
                  <ArrowRight size={17} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={(event) => {
                    event.currentTarget.focus();
                    setFacts(true);
                  }}
                >
                  Read the brief <ArrowUpRight size={15} />
                </Button>
              </div>
              <div className="hero-journey" aria-label="Your practice journey">
                <span>
                  <b>01</b> Converse
                </span>
                <i aria-hidden="true" />
                <span>
                  <b>02</b> Rewind
                </span>
                <i aria-hidden="true" />
                <span>
                  <b>03</b> Compare
                </span>
              </div>
              <span className="hero-footnote">
                <ShieldCheck size={14} /> Fictional scenarios. Real room to
                practice.
              </span>
            </div>
            <div className="studio-hero-portrait">
              <Image
                src="/images/priya.webp"
                alt="Priya, a fictional customer in an office"
                fill
                sizes="(max-width: 760px) 100vw, 480px"
                priority
              />
              <div className="hero-image-shade" />
              <span className="hero-persona-label">
                <span /> FICTIONAL PERSONA / 001
              </span>
              <div className="hero-persona-caption">
                <span>YOUR NEXT CONVERSATION</span>
                <h2>Meet Priya.</h2>
                <p>
                  Thoughtful. Skeptical.
                  <br />
                  Looking for an honest answer.
                </p>
              </div>
              <span className="hero-format">
                <MessageSquare size={14} /> Text-first roleplay{" "}
                <span>5–10 min</span>
              </span>
            </div>
          </section>
        )}
        {!historyOnly && (
          <LanguageControls locale={locale} onChange={selectLocale} />
        )}
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {!historyOnly && (
          <>
            <section
              className="scenario-brief-card"
              aria-labelledby="featured-title"
            >
              <div>
                <span className="eyebrow">
                  FEATURED PRACTICE / CUSTOMER NEGOTIATION
                </span>
                <h2 id="featured-title">The trust conversation.</h2>
                <p>
                  A customer wants clarity, not another promise. Understand her
                  concerns and explain the limits of a fictional policy.
                </p>
              </div>
              <div className="brief-focus">
                <span className="eyebrow accent-secondary">
                  WHAT YOU’LL PRACTICE
                </span>
                <ul>
                  <li>
                    <Check size={15} /> Discover what matters
                  </li>
                  <li>
                    <Check size={15} /> Explain without overpromising
                  </li>
                  <li>
                    <Check size={15} /> Agree on a suitable next step
                  </li>
                </ul>
              </div>
            </section>
            <ScenarioLibrary
              onStart={start}
              busy={busy}
              available={textPracticeAvailable}
              locale={locale}
            />
            <section className="how-section">
              <div className="section-heading">
                <h2>A better way to learn by doing</h2>
                <span className="subtle-label">
                  Every decision is a starting point
                </span>
              </div>
              <div className="how-grid">
                {[
                  {
                    n: "01",
                    Icon: MessageSquare,
                    title: "Practice the moment",
                    text: "Step into a realistic conversation with a character who responds to your choices.",
                  },
                  {
                    n: "02",
                    Icon: RotateCcw,
                    title: "Take another path",
                    text: "Return to a decision and try a different response. Your original stays intact.",
                  },
                  {
                    n: "03",
                    Icon: GitBranch,
                    title: "See what changes",
                    text: "Compare both conversations and learn from feedback linked to what you said.",
                  },
                ].map(({ n, Icon, title, text }) => (
                  <div className="how-card" key={n}>
                    <div className="how-top">
                      <Icon size={20} />
                      <span>{n}</span>
                    </div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
        {(historyOnly || sessions.length > 0) && (
          <section className="history-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
                <h2>Your practice history</h2>
              </div>
              <span className="subtle-label">
                Saved to this browser · 30-day access
              </span>
            </div>
            {sessionsLoading ? (
              <div className="history-loading" role="status">
                <LoaderCircle size={18} className="spin" />
                <span>Loading your saved practice…</span>
              </div>
            ) : error ? (
              <div className="empty-state">
                <h3>Your history is temporarily unavailable.</h3>
                <p>Your saved practice has not been changed.</p>
                <Button variant="secondary" onClick={refreshHistory}>
                  Retry history
                </Button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="empty-state">
                <GitBranch size={28} />
                <h3>Your first possibility is waiting.</h3>
                <p>
                  Start a scenario and your saved conversations will appear
                  here.
                </p>
                <Button
                  onClick={() => start()}
                  disabled={busy || !textPracticeAvailable}
                >
                  Begin practice <ArrowRight size={16} />
                </Button>
              </div>
            ) : (
              sessions.map((session, i) => (
                <div className="history-row" key={session.id}>
                  <span className="history-icon">
                    <MessageSquare size={18} />
                  </span>
                  <div>
                    <a href={`/sessions/${session.id}`}>
                      {session.title ?? "The trust conversation"}{" "}
                      <ChevronRight size={15} />
                    </a>
                    <small>
                      {new Date(session.createdAt).toLocaleDateString(locale, {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {session.branches.length}{" "}
                      {session.branches.length === 1
                        ? "approach"
                        : "approaches"}{" "}
                      · Practice {sessions.length - i}
                    </small>
                  </div>
                  <a className="resume-link" href={`/sessions/${session.id}`}>
                    Resume <ArrowRight size={15} />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete practice ${sessions.length - i}`}
                    onClick={() => remove(session.id)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              ))
            )}
          </section>
        )}
        <div className="studio-bottom-note">
          <Check size={15} /> No real customers. No perfect answers. Just room
          to get better.
        </div>
      </main>
      <Drawer
        open={facts}
        onOpenChange={setFacts}
        title="Your scenario brief"
        description="You are a salesperson discussing a fictional insurance policy with Priya. Your goal is a suitable next step, not a sale at any cost."
      >
        <Facts />
        <h3 className="drawer-subheading">What you’re practicing</h3>
        <ul className="objective-list">
          {scenario.objectives.map((o) => (
            <li key={o}>
              <Check size={15} />
              {o}
            </li>
          ))}
        </ul>
      </Drawer>
    </Shell>
  );
}
export function Facts({
  locale = "en-IN",
  facts,
}: {
  locale?: PracticeLocale;
  facts?: readonly { id: string; title: string; detail: string }[];
}) {
  return (
    <div className="facts-list" lang={locale}>
      <div className="fictional-banner">
        <ShieldCheck size={16} /> Fictional training data. These are not real
        policy terms.
      </div>
      {(facts ?? localizedContent[locale].facts).map((fact, i) => (
        <div className="fact" key={fact.id}>
          <span>0{i + 1}</span>
          <div>
            <h3>{fact.title}</h3>
            <p>{fact.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryMark() {
  return (
    <div className="history-mark" aria-hidden="true">
      <GitBranch size={72} strokeWidth={0.8} />
      <span>Every path has a story.</span>
    </div>
  );
}
