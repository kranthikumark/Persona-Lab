"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, FileText, Plus, Save, Trash2 } from "lucide-react";
import { Shell } from "./shell";
import { Button } from "./ui/button";
import { api } from "@/lib/client";
import { type DraftContent } from "@/lib/catalog/schema";
import { DEFAULT_CATALOG } from "@/lib/practice/metadata";

type Draft = {
  id: string;
  revision: number;
  status: string;
  content: DraftContent;
  review?: { reviewer?: string; reviewedAt?: string } | null;
};
export function ScenarioCreator({ mode }: { mode: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]),
    [selected, setSelected] = useState<Draft | null>(null),
    [content, setContent] = useState<DraftContent | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const dirty =
    !!selected && JSON.stringify(content) !== JSON.stringify(selected.content);
  async function load() {
    setError("");
    try {
      setDrafts((await api<{ drafts: Draft[] }>("/api/catalog/drafts")).drafts);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  function select(draft: Draft) {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setSelected(draft);
    setContent(structuredClone(draft.content));
    setMessage("");
    setError("");
  }
  async function create() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setBusy(true);
    setError("");
    try {
      const d = await api<Draft>("/api/catalog/drafts", {});
      setSelected(d);
      setContent(d.content);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!selected || !content) return;
    setBusy(true);
    setError("");
    try {
      const d = await api<Draft>(
        `/api/catalog/drafts/${selected.id}`,
        { revision: selected.revision, content },
        "PATCH",
      );
      setSelected(d);
      setContent(d.content);
      setMessage(
        "Saved privately. This revision needs operator review before publication.",
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (
      !selected ||
      !window.confirm(
        "Delete this private draft? Published versions and sessions remain available.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/catalog/drafts/${selected.id}`, undefined, "DELETE");
      setSelected(null);
      setContent(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell page="Text Scenario Studio" mode={mode}>
      <main
        className="studio-main creator-main"
        id="page-content"
        tabIndex={-1}
      >
        <Link className="resume-link" href="/">
          <ArrowLeft size={16} /> Back to library
        </Link>
        <section className="creator-intro">
          <span className="eyebrow accent-secondary">
            CREATE WITH INTENTION
          </span>
          <h1>
            A conversation,
            <br />
            <em>shaped by you.</em>
          </h1>
          <p>
            Start with the verified Priya insurance template. Shape the brief
            and learning objectives, then request a review of the exact saved
            revision.
          </p>
        </section>
        <div className="creator-note">
          <Check size={18} />
          <p>
            Private to this browser · expires after 30 days. Only an operator
            with server access can review and publish. English text only; new
            characters, policy facts, translated versions and media authoring
            require separate verification.
          </p>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {message && <p role="status">{message}</p>}
        <div className="creator-layout">
          <aside className="draft-list" aria-label="Private drafts">
            <div className="section-heading">
              <h2>Your drafts</h2>
              <Button onClick={create} disabled={busy} size="sm">
                <Plus size={15} /> New draft
              </Button>
            </div>
            {loading ? (
              <p role="status">Loading drafts…</p>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={load}
                >
                  Reload drafts
                </Button>
                {drafts.map((d) => (
                  <button
                    key={d.id}
                    className={`draft-choice ${selected?.id === d.id ? "selected" : ""}`}
                    disabled={busy}
                    aria-pressed={selected?.id === d.id}
                    onClick={() => select(d)}
                  >
                    <FileText size={18} />
                    <span>
                      <strong>{d.content.title}</strong>
                      <small>
                        Revision {d.revision} · {d.status}
                      </small>
                    </span>
                  </button>
                ))}
                {!drafts.length && (
                  <p>Your first draft starts with a tested foundation.</p>
                )}
              </>
            )}
          </aside>
          <section className="draft-editor" aria-labelledby="editor-title">
            {content && selected ? (
              <>
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {selected.status} · REVISION {selected.revision}
                      {dirty ? " · UNSAVED" : ""}
                    </span>
                    <h2 id="editor-title">Your scenario brief</h2>
                  </div>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save();
                  }}
                >
                  <fieldset disabled={busy} className="creator-fields">
                    <label>
                      Title
                      <input
                        required
                        minLength={3}
                        maxLength={100}
                        value={content.title}
                        onChange={(e) =>
                          setContent({ ...content, title: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Description
                      <textarea
                        required
                        minLength={10}
                        maxLength={600}
                        rows={3}
                        value={content.description}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            description: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Difficulty
                      <select
                        aria-label="Difficulty"
                        value={content.catalog.difficulty}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            catalog: {
                              ...content.catalog,
                              difficulty: e.target
                                .value as DraftContent["catalog"]["difficulty"],
                            },
                          })
                        }
                      >
                        {["beginner", "intermediate", "advanced"].map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <small>
                        Describes the intended audience; does not change
                        character difficulty automatically.
                      </small>
                    </label>
                    <fieldset className="goal-choices">
                      <legend>Practice goals</legend>
                      {DEFAULT_CATALOG.skillGoals.map((goal) => (
                        <label key={goal}>
                          <input
                            type="checkbox"
                            checked={content.catalog.skillGoals.includes(goal)}
                            onChange={(e) =>
                              setContent({
                                ...content,
                                catalog: {
                                  ...content.catalog,
                                  skillGoals: e.target.checked
                                    ? [...content.catalog.skillGoals, goal]
                                    : content.catalog.skillGoals.filter(
                                        (g) => g !== goal,
                                      ),
                                },
                              })
                            }
                          />
                          {goal}
                        </label>
                      ))}
                    </fieldset>
                    <label>
                      Learning objectives · one per line
                      <textarea
                        rows={4}
                        required
                        value={content.objectives.join("\n")}
                        onChange={(e) =>
                          setContent({
                            ...content,
                            objectives: e.target.value.split("\n"),
                          })
                        }
                      />
                      <small>
                        1–5 objectives. Review must confirm they fit the
                        existing insurance rubric.
                      </small>
                    </label>
                    <details className="locked-contract">
                      <summary>
                        Verified foundation · fixed for this template
                      </summary>
                      <p>
                        Priya · prospective customer · Business edition ·
                        English text
                      </p>
                      <h3>Canonical facts</h3>
                      {content.approvedFacts.map((f) => (
                        <p key={f.id}>
                          <strong>{f.title}:</strong> {f.detail}
                        </p>
                      ))}
                      <h3>Constraints</h3>
                      <ul>
                        {content.constraints.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                      <h3>Quality rubric</h3>
                      <p>
                        Accuracy 30% · Discovery 20% · Objections 20% ·
                        Communication 15% · Next step 15%. The 70-word limit is
                        assessed separately.
                      </p>
                      <p>
                        Translation: English baseline. Hindi and Telugu
                        authoring remain unavailable pending review.
                      </p>
                    </details>
                    <div className="creator-actions">
                      <Button type="submit" disabled={!dirty}>
                        <Save size={16} /> Save revision
                      </Button>
                      <Button type="button" variant="ghost" onClick={remove}>
                        <Trash2 size={16} /> Delete draft
                      </Button>
                    </div>
                  </fieldset>
                </form>
                <details className="operator-handoff">
                  <summary>How to request publication</summary>
                  <p>
                    Share the draft ID and revision with your local operator.
                    They inspect the full content, record a named review, and
                    publish through the server command. Editing invalidates that
                    approval. Published versions and existing sessions remain
                    unchanged.
                  </p>
                  <code>
                    Draft {selected.id} · Revision {selected.revision}
                  </code>
                </details>
              </>
            ) : (
              <div className="empty-state">
                <FileText size={30} />
                <h2 id="editor-title">Make room for a new brief.</h2>
                <p>
                  Create a draft or choose one from your private collection.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </Shell>
  );
}
