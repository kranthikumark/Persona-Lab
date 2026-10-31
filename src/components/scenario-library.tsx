"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Plus } from "lucide-react";
import { api } from "@/lib/client";
import type { CatalogEntry } from "@/lib/catalog/schema";
import { Button } from "./ui/button";

export function ScenarioLibrary({
  onStart,
  busy,
  available,
  locale,
}: {
  onStart: (id: string) => void;
  busy: boolean;
  available: boolean;
  locale: string;
}) {
  const [entries, setEntries] = useState<CatalogEntry[]>([]),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState("ALL"),
    [goal, setGoal] = useState(""),
    [role, setRole] = useState(""),
    [difficulty, setDifficulty] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setEntries(
        (await api<{ scenarios: CatalogEntry[] }>("/api/catalog")).scenarios,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);
  const filtered = entries.filter(
    (e) =>
      (audience === "ALL" ||
        e.catalog.audience === audience ||
        e.catalog.audience === "BOTH") &&
      (!goal || e.catalog.skillGoals.includes(goal)) &&
      (!role || e.catalog.traineeRole === role) &&
      (!difficulty || e.catalog.difficulty === difficulty),
  );
  return (
    <section className="scenario-library" aria-labelledby="library-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow accent-secondary">
            FIND YOUR NEXT CONVERSATION
          </span>
          <h2 id="library-title">The practice library</h2>
        </div>
        <Link href="/create" className="resume-link">
          <Plus size={16} /> Create a scenario
        </Link>
      </div>
      <div className="catalog-filters">
        <label>
          Edition
          <select
            aria-label="Edition"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="ALL">All editions</option>
            <option value="BUSINESS">Business</option>
            <option value="PERSONAL">Personal</option>
          </select>
        </label>
        <label>
          Goal
          <select
            aria-label="Goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          >
            <option value="">All goals</option>
            {[...new Set(entries.flatMap((e) => e.catalog.skillGoals))].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Role
          <select
            aria-label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles</option>
            {[...new Set(entries.map((e) => e.catalog.traineeRole))].map(
              (v) => (
                <option key={v}>{v}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Difficulty
          <select
            aria-label="Difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="">All levels</option>
            {["beginner", "intermediate", "advanced"].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="subtle-label">
        Business: verified insurance text practice. Personal templates are
        awaiting their own tested rules and rubric.
      </p>
      {error ? (
        <div role="alert" className="error-banner">
          {error}{" "}
          <Button variant="ghost" onClick={load}>
            Retry library
          </Button>
        </div>
      ) : loading ? (
        <p role="status">Loading the library…</p>
      ) : (
        <>
          <p role="status" className="subtle-label">
            {filtered.length} {filtered.length === 1 ? "scenario" : "scenarios"}{" "}
            found
          </p>
          <div className="catalog-grid">
            {filtered.map((entry) => (
              <article className="catalog-card" key={entry.id}>
                <div className="catalog-card-top">
                  <BookOpen size={20} />
                  <span>BUSINESS · TEXT · V{entry.version}</span>
                </div>
                <h3>{entry.title}</h3>
                <p>{entry.description}</p>
                <div className="catalog-tags">
                  <span>{entry.catalog.difficulty}</span>
                  {entry.catalog.skillGoals.map((g) => (
                    <span key={g}>{g}</span>
                  ))}
                </div>
                <small>{entry.catalog.traineeRole}</small>
                <Button
                  variant="secondary"
                  disabled={
                    busy || !available || !entry.locales.includes(locale)
                  }
                  onClick={() => onStart(entry.id)}
                >
                  {entry.locales.includes(locale)
                    ? "Begin this practice"
                    : "Select English for this version"}
                  <ArrowRight size={15} />
                </Button>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <h3>
                {audience === "PERSONAL"
                  ? "Personal practice is on its way."
                  : "No matching scenarios yet."}
              </h3>
              <p>
                {audience === "PERSONAL"
                  ? "Interview and everyday conversation templates will appear after their rules and feedback are verified."
                  : "Try another goal, role or difficulty."}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  setAudience("ALL");
                  setGoal("");
                  setRole("");
                  setDifficulty("");
                }}
              >
                Reset filters
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
