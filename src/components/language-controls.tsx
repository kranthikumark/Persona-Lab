"use client";
import { useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { api } from "@/lib/client";
import {
  localizedContent,
  type PracticeLocale,
} from "@/lib/localization/content";
export function LanguageControls({
  locale,
  onChange,
}: {
  locale: PracticeLocale;
  onChange: (locale: PracticeLocale) => void;
}) {
  const changed = useRef(false);
  const [available, setAvailable] = useState<PracticeLocale[]>(["en-IN"]),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      api<{ locales: { locale: PracticeLocale; textAvailable: boolean }[] }>(
        "/api/capabilities",
      ),
      api<{ preferences: { practiceLocale: PracticeLocale } }>(
        "/api/preferences",
      ),
    ])
      .then(([capabilities, preferences]) => {
        if (!active) return;
        const enabled = capabilities.locales
          .filter((l) => l.textAvailable)
          .map((l) => l.locale);
        setAvailable(enabled);
        if (
          !changed.current &&
          enabled.includes(preferences.preferences.practiceLocale)
        )
          onChange(preferences.preferences.practiceLocale);
        else if (!changed.current)
          setMessage(
            "The saved practice language is unavailable. English is selected; saved conversations keep their language.",
          );
      })
      .catch(() => {
        if (active)
          setMessage(
            "Language preferences could not load. English remains selected.",
          );
      });
    return () => {
      active = false;
    };
  }, [onChange]);
  async function save() {
    try {
      await api(
        "/api/preferences",
        {
          practiceLocale: locale,
          characterLocale: locale,
          interfaceLocale: "en-IN",
          coachingLocale: "en-IN",
        },
        "PUT",
      );
      setMessage("Language preferences saved for your next practice.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  return (
    <section className="language-card" aria-label="Language settings">
      <div className="language-card-heading">
        <Languages size={19} aria-hidden="true" />
        <div>
          <h2>Practice in your language</h2>
          <p>
            New practices use these settings. Saved conversations keep their
            language.
          </p>
        </div>
      </div>
      <div className="language-grid">
        <label>
          Interface
          <select value="en-IN" disabled aria-describedby="language-fallback">
            <option value="en-IN">English · available</option>
          </select>
        </label>
        <label>
          Practice &amp; character
          <select
            value={locale}
            onChange={(e) => {
              changed.current = true;
              onChange(e.target.value as PracticeLocale);
            }}
          >
            {(["en-IN", "hi-IN", "te-IN"] as const).map((value) => (
              <option
                value={value}
                key={value}
                disabled={!available.includes(value)}
              >
                {value === "en-IN"
                  ? "English"
                  : value === "hi-IN"
                    ? "हिन्दी · Hindi"
                    : "తెలుగు · Telugu"}
                {!available.includes(value)
                  ? " — review pending"
                  : value !== "en-IN"
                    ? " — acceptance preview"
                    : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Coaching
          <select value="en-IN" disabled aria-describedby="language-fallback">
            <option value="en-IN">English · explicit fallback</option>
          </select>
        </label>
      </div>
      <p aria-live="polite" className="language-note">
        Your next conversation:{" "}
        <strong lang={locale}>
          {locale === "en-IN"
            ? "English"
            : locale === "hi-IN"
              ? "हिन्दी"
              : "తెలుగు"}
        </strong>
      </p>
      <p id="language-fallback" className="language-note">
        Interface and coaching currently use English. Hindi/Telugu practice
        requires language review and release verification. Original-script
        responses are preserved.
      </p>
      <button
        className="button button-secondary button-sm"
        onClick={save}
        type="button"
      >
        Save language preferences
      </button>
      <p role="status" className="language-note">
        {message}
      </p>
      <details className="translation-review">
        <summary>Review Hindi / Telugu translation drafts</summary>
        <p>
          Read-only drafts. These previews do not enable a practice language.
        </p>
        {(["hi-IN", "te-IN"] as const).map((value) => (
          <section key={value} lang={value}>
            <h3>{localizedContent[value].title}</h3>
            <p>{localizedContent[value].opening}</p>
            {localizedContent[value].facts.map((f) => (
              <p key={f.id}>
                <strong>{f.title}</strong>
                <br />
                {f.detail}
              </p>
            ))}
          </section>
        ))}
      </details>
    </section>
  );
}
