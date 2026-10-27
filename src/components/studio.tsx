"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clock3,
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

export function Studio({ mode }: { mode: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const historyOnly = search.get("view") === "history";
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
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
  async function start() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ sessionId: string }>("/api/sessions", {});
      router.push(`/sessions/${result.sessionId}`);
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
        <section className="studio-intro">
          <div>
            <div className="eyebrow mint">
              <span className="tiny-line" /> YOUR NEXT POSSIBILITY
            </div>
            <h1>
              {historyOnly ? (
                <>
                  Every attempt.
                  <br />
                  <em>A new perspective.</em>
                </>
              ) : (
                <>
                  Better conversations
                  <br />
                  begin with <em>practice.</em>
                </>
              )}
            </h1>
            <p className="intro-copy">
              A safe space for the conversations that matter.
              <br />
              Make a decision. Rewind the moment. Discover another way.
            </p>
          </div>
          <div className="branch-art" aria-hidden="true">
            <svg viewBox="0 0 380 230">
              <defs>
                <linearGradient id="pathGradient">
                  <stop stopColor="#8070df" />
                  <stop offset="1" stopColor="#79d7bd" />
                </linearGradient>
              </defs>
              <path
                className="art-grid"
                d="M0 60H380M0 115H380M0 170H380M70 0V230M140 0V230M210 0V230M280 0V230M350 0V230"
              />
              <path
                className="art-path-secondary"
                d="M20 175H130Q165 175 190 140L220 102Q240 78 270 78H355"
              />
              <path
                className="art-path"
                d="M20 175H130Q165 175 190 140L244 180Q259 190 285 190H355"
              />
              <circle cx="135" cy="175" r="18" className="art-halo" />
              <circle cx="135" cy="175" r="6" fill="#b5a4ff" />
              <circle cx="270" cy="78" r="7" fill="#89dfc6" />
              <circle cx="285" cy="190" r="6" fill="#b5a4ff" />
              <text x="207" y="45">
                WHAT IF YOU TRIED...
              </text>
              <text x="265" y="217">
                ANOTHER WAY?
              </text>
            </svg>
            <span className="art-label">
              <GitBranch size={13} /> One moment. More possibilities.
            </span>
          </div>
        </section>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {!historyOnly && (
          <>
            <div className="section-heading">
              <div>
                <span className="eyebrow">CURATED FOR YOUR PRACTICE</span>
                <h2>Step into a scenario</h2>
              </div>
              <span className="subtle-label">
                01 scenario <span className="footer-dot">·</span> Multiple
                possibilities
              </span>
            </div>
            <section className="featured-scenario">
              <div className="scenario-portrait">
                <Image
                  src="/images/priya.webp"
                  alt="Priya, a fictional customer in an office"
                  fill
                  sizes="(max-width: 760px) 100vw, 380px"
                  priority
                />
                <div className="portrait-shade" />
                <span className="portrait-topline">
                  <span /> MEET YOUR COUNTERPART
                </span>
                <div className="portrait-caption">
                  <span className="portrait-name">Priya</span>
                  <span>Thoughtful. Skeptical. Ready to listen.</span>
                </div>
              </div>
              <div className="scenario-content">
                <div className="scenario-meta">
                  <span className="pill violet">
                    <ShieldCheck size={13} /> Customer negotiation
                  </span>
                  <span className="scenario-number">SCENARIO / 001</span>
                </div>
                <h2>
                  The trust <br />
                  conversation<span>.</span>
                </h2>
                <p>
                  A customer wants clarity, not another promise.
                  <br className="desktop-break" /> Can you turn skepticism into
                  an honest conversation?
                </p>
                <div className="scenario-tags">
                  <span>
                    <Clock3 size={14} /> 5–10 min practice
                  </span>
                  <span>
                    <MessageSquare size={14} /> Text conversation
                  </span>
                </div>
                <div className="scenario-divider" />
                <div className="scenario-objective">
                  <span className="eyebrow">YOUR CHALLENGE</span>
                  <p>
                    Understand her concerns. Explain the limits.
                    <br />
                    Earn trust without overpromising.
                  </p>
                </div>
                <div className="scenario-actions">
                  <Button onClick={start} disabled={busy}>
                    {busy ? (
                      <LoaderCircle size={17} className="spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {busy ? "Opening your studio…" : "Begin practice"}
                    <ArrowRight size={17} />
                  </Button>
                  <Button variant="ghost" onClick={() => setFacts(true)}>
                    Read the brief <ArrowUpRight size={15} />
                  </Button>
                </div>
                <div className="disclaimer-small">
                  <ShieldCheck size={12} /> Fictional policy and character. A
                  safe space to experiment.
                </div>
              </div>
            </section>
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
                <Button onClick={start} disabled={busy}>
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
                    <Link href={`/sessions/${session.id}`}>
                      The trust conversation <ChevronRight size={15} />
                    </Link>
                    <small>
                      {new Date(session.createdAt).toLocaleDateString("en-IN", {
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
                  <Link
                    className="resume-link"
                    href={`/sessions/${session.id}`}
                  >
                    Resume <ArrowRight size={15} />
                  </Link>
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
export function Facts() {
  return (
    <div className="facts-list">
      <div className="fictional-banner">
        <ShieldCheck size={16} /> Fictional training data. These are not real
        policy terms.
      </div>
      {scenario.approvedFacts.map((fact, i) => (
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
