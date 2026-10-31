"use client";
import { useEffect, useState } from "react";
import {
  Upload,
  FileAudio,
  Film,
  Check,
  Trash2,
  LoaderCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { api } from "@/lib/client";
import { MAX_SOURCE_BYTES, type SourceDTO } from "@/lib/media/contracts";
import type { DraftContent } from "@/lib/catalog/schema";
type Draft = {
  id: string;
  revision: number;
  status: string;
  content: DraftContent;
  review?: { reviewer?: string; reviewedAt?: string } | null;
};
type Listing = {
  sources: SourceDTO[];
  toolsAvailable: boolean;
  transcriptionLocales: string[];
};
export function ScenarioSources({
  draft,
  disabled,
  onBusy,
  onChange,
}: {
  draft: Draft;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onChange: (draft: Draft) => void;
}) {
  const [listing, setListing] = useState<Listing | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null),
    [locale, setLocale] = useState("en-IN"),
    [days, setDays] = useState(1),
    [rights, setRights] = useState(false),
    [retain, setRetain] = useState(false),
    [working, setWorking] = useState("");
  const base = `/api/catalog/drafts/${draft.id}/sources`;
  useEffect(() => {
    let active = true;
    void api<Listing>(base)
      .then((data) => {
        if (active) setListing(data);
      })
      .catch(() => {
        if (active)
          setError("Could not load sources. Reload the draft to try again.");
      });
    return () => {
      active = false;
    };
  }, [base, draft.revision]);
  async function refresh() {
    const updated = await api<Draft>(`/api/catalog/drafts/${draft.id}`);
    onChange(updated);
    setListing(await api<Listing>(base));
  }
  async function reloadSources() {
    onBusy(true);
    setWorking("Reloading sources…");
    setError("");
    setMessage("");
    try {
      await refresh();
    } catch {
      setError(
        "Could not reload sources. Try again after the connection returns.",
      );
    } finally {
      setWorking("");
      onBusy(false);
    }
  }
  async function action(label: string, run: () => Promise<{ draft: Draft }>) {
    onBusy(true);
    setWorking(label);
    setError("");
    setMessage("");
    try {
      const result = await run();
      onChange(result.draft);
      setListing(await api<Listing>(base));
      setMessage(
        label === "Saving private source…"
          ? "Source saved privately. Review its transcript before attachment."
          : label === "Deleting source…"
            ? "Source and transcript versions deleted. Published scenarios remain available."
            : label === "Attaching reviewed transcript…"
              ? "Reviewed source attached. This draft revision needs operator approval."
              : "Transcript ready. Review and correct it before attaching.",
      );
    } catch (e) {
      setError((e as Error).message);
      try {
        await refresh();
      } catch {
        /* Existing editor stays available. */
      }
    } finally {
      onBusy(false);
      setWorking("");
    }
  }
  async function upload() {
    if (!file) return;
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Choose a file no larger than 20 MB.");
      return;
    }
    const name = file.name,
      extension = name.split(".").at(-1)?.toLowerCase();
    const mime =
      file.type ||
      (
        {
          wav: "audio/wav",
          mp3: "audio/mpeg",
          m4a: "audio/mp4",
          mp4: "video/mp4",
          webm: "video/webm",
        } as Record<string, string>
      )[extension ?? ""] ||
      "application/octet-stream";
    await action("Saving private source…", async () => {
      const response = await fetch(base, {
        method: "POST",
        headers: {
          "Content-Type": mime,
          "X-Source-Meta": encodeURIComponent(
            JSON.stringify({
              draftRevision: draft.revision,
              name,
              bytes: file.size,
              locale,
              retentionDays: days,
              rights,
              retention: retain,
            }),
          ),
        },
        body: file,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ?? "Upload failed. Choose the file again.",
        );
      setFile(null);
      setRights(false);
      setRetain(false);
      return result;
    });
  }
  return (
    <section className="source-studio" aria-labelledby="source-heading">
      <div className="source-heading">
        <div>
          <span className="eyebrow accent-secondary">REFERENCE MATERIAL</span>
          <h3 id="source-heading">Bring a conversation to the brief.</h3>
        </div>
        <div className="source-heading-actions">
          <span className="source-private">Private sources</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || !!working}
            onClick={reloadSources}
          >
            Reload sources
          </Button>
        </div>
      </div>
      <p className="source-intro">
        Add a short recording, review the words, and attach it to this draft.
        Sources inform your brief; they do not replace verified policy facts or
        publish automatically.
      </p>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="source-notice" role="status">
          <Check size={16} />
          {message}
        </p>
      )}
      {working && (
        <p className="source-notice" role="status">
          <LoaderCircle size={16} />
          {working}
        </p>
      )}
      {disabled && !working && (
        <p className="source-notice">
          Save your brief changes before working with sources.
        </p>
      )}
      <fieldset
        disabled={disabled || !!working || !listing?.toolsAvailable}
        className="source-upload"
      >
        <legend>Add an audio or video source</legend>
        <label className="source-file">
          <Upload size={22} />
          <span>
            {file ? file.name : "Choose a recording"}
            <small>WAV, MP3, M4A, MP4 or WebM · up to 60 seconds · 20 MB</small>
          </span>
          <input
            aria-label="Source recording"
            type="file"
            accept=".wav,.mp3,.m4a,.mp4,.webm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="source-options">
          <label>
            Source language
            <select value={locale} onChange={(e) => setLocale(e.target.value)}>
              <option value="en-IN">English</option>
              <option value="hi-IN">हिन्दी · Hindi</option>
              <option value="te-IN">తెలుగు · Telugu</option>
            </select>
          </label>
          <label>
            Keep source for
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
            </select>
          </label>
        </div>
        <label className="source-consent">
          <input
            type="checkbox"
            checked={rights}
            onChange={(e) => setRights(e.target.checked)}
          />
          I have permission to upload and use this recording.
        </label>
        <label className="source-consent">
          <input
            type="checkbox"
            checked={retain}
            onChange={(e) => setRetain(e.target.checked)}
          />
          Store this source and its transcripts privately for the selected
          period. I can delete them sooner.
        </label>
        <Button
          type="button"
          onClick={upload}
          disabled={!file || !rights || !retain}
        >
          <Upload size={15} />
          Save private source
        </Button>
      </fieldset>
      {listing && !listing.toolsAvailable && (
        <p role="status">
          Media tools are unavailable on this server. Text authoring is still
          available.
        </p>
      )}
      <p className="source-footnote">
        Transcription is a separate choice. Only the audio track is sent to Meta
        when you select Transcribe. Video scenes, faces and emotions are not
        analysed. The scenario remains English; the source language describes
        its transcript.
      </p>
      <div
        className="source-list"
        role="group"
        aria-label="Saved private sources"
      >
        {listing?.sources.map((source) => (
          <SourceCard
            key={`${source.id}:${source.revision}:${source.status}`}
            source={source}
            disabled={disabled || !!working}
            canTranscribe={listing.transcriptionLocales.includes(source.locale)}
            base={base}
            onAction={action}
            draftRevision={draft.revision}
          />
        ))}
      </div>
    </section>
  );
}
function SourceCard({
  source,
  disabled,
  canTranscribe,
  base,
  onAction,
  draftRevision,
}: {
  source: SourceDTO;
  disabled: boolean;
  canTranscribe: boolean;
  base: string;
  draftRevision: number;
  onAction: (
    label: string,
    run: () => Promise<{ draft: Draft }>,
  ) => Promise<void>;
}) {
  const [text, setText] = useState(source.transcript?.text ?? ""),
    [translation, setTranslation] = useState(
      source.transcript?.translation ?? "",
    ),
    [confirmed, setConfirmed] = useState(false);
  const [versions, setVersions] = useState<
      | {
          version: number;
          text: string;
          translation: string | null;
          locale: string;
          provider: string;
        }[]
      | null
    >(null),
    [historyStatus, setHistoryStatus] = useState("");
  const url = `${base}/${source.id}`,
    unavailable = ["expired", "uploading", "deleting", "processing"].includes(
      source.status,
    );
  const labels: Record<string, string> = {
    uploaded: "Ready for transcript",
    transcribed: "Review transcript",
    reviewed: "Reviewed · attached",
    failed: "Needs a transcript",
    expired: "Expired",
    processing: "Transcribing",
    uploading: "Uploading",
    deleting: "Deletion pending",
  };
  return (
    <article className="source-card">
      <div className="source-card-heading">
        {source.kind === "video" ? <Film size={20} /> : <FileAudio size={20} />}
        <div>
          <h4>{source.name}</h4>
          <p>
            {source.locale} ·{" "}
            {source.durationMs
              ? `${(source.durationMs / 1000).toFixed(1)} sec · `
              : ""}
            {source.byteSize < 1024 * 1024
              ? `${Math.ceil(source.byteSize / 1024)} KB`
              : `${(source.byteSize / 1024 / 1024).toFixed(1)} MB`}
          </p>
        </div>
        <span className={`source-status ${source.status}`}>
          {labels[source.status] ?? source.status}
        </span>
      </div>
      <p className="source-expiry">
        Expires {new Date(source.expiresAt).toLocaleString()} · deleting removes
        the file and every transcript version.
      </p>
      {!unavailable &&
        (source.kind === "video" ? (
          <video
            controls
            playsInline
            preload="none"
            src={`${url}/file`}
            aria-label={`Preview ${source.name}`}
          />
        ) : (
          <audio
            controls
            preload="none"
            src={`${url}/file`}
            aria-label={`Preview ${source.name}`}
          />
        ))}
      {source.failureReason && <p role="status">{source.failureReason}</p>}
      <fieldset disabled={disabled || unavailable} className="source-review">
        <div className="source-transcribe">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canTranscribe || source.status === "reviewed"}
            onClick={() =>
              onAction("Transcribing audio with Meta…", () =>
                api(url, {
                  action: "transcribe",
                  revision: source.revision,
                  draftRevision,
                  processingConsent: true,
                }),
              )
            }
          >
            Transcribe with Meta
          </Button>
          <small>
            {canTranscribe
              ? "Selecting this sends the audio track to Meta. Review the result below."
              : "Transcription is unavailable for this locale. Enter a transcript manually."}
          </small>
        </div>
        <label>
          Transcript
          {source.transcript && (
            <small>
              Version {source.transcript.version} ·{" "}
              {source.transcript.provider === "meta"
                ? "Meta draft, not yet approved"
                : "Creator-reviewed text"}
            </small>
          )}
          <textarea
            rows={5}
            lang={source.locale}
            maxLength={12000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setConfirmed(false);
            }}
            placeholder="Transcribe the clip, or enter its words yourself."
          />
        </label>
        {source.locale !== "en-IN" && (
          <label>
            English translation · optional
            <textarea
              rows={3}
              lang="en-IN"
              maxLength={12000}
              value={translation}
              onChange={(e) => {
                setTranslation(e.target.value);
                setConfirmed(false);
              }}
              placeholder="Add a translation you have reviewed."
            />
          </label>
        )}
        <label className="source-consent">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I reviewed this transcript and any translation for accuracy.
        </label>
        <Button
          type="button"
          size="sm"
          disabled={!confirmed || !text.trim()}
          onClick={() =>
            onAction("Attaching reviewed transcript…", () =>
              api(url, {
                action: "review",
                revision: source.revision,
                draftRevision,
                text,
                translation,
                confirmed: true,
              }),
            )
          }
        >
          <Check size={15} />
          Review & attach source
        </Button>
      </fieldset>
      {!unavailable && (source.transcript?.version ?? 0) > 1 && (
        <details
          className="source-history"
          onToggle={(event) => {
            if (
              !event.currentTarget.open ||
              versions ||
              historyStatus === "Loading versions…"
            )
              return;
            setHistoryStatus("Loading versions…");
            void api<{ versions: NonNullable<typeof versions> }>(
              `${url}/transcripts`,
            )
              .then((data) => {
                setVersions(data.versions);
                setHistoryStatus("");
              })
              .catch(() =>
                setHistoryStatus(
                  "Could not load earlier versions. Close and reopen to retry.",
                ),
              );
          }}
        >
          <summary>
            Transcript history · {source.transcript!.version} versions
          </summary>
          {historyStatus && <p role="status">{historyStatus}</p>}
          {versions?.map((version) => (
            <div key={version.version}>
              <strong>
                Version {version.version} ·{" "}
                {version.provider === "meta" ? "Meta draft" : "Creator review"}
              </strong>
              <p lang={version.locale} tabIndex={0}>
                {version.text}
              </p>
              {version.translation && <p lang="en-IN">{version.translation}</p>}
            </div>
          ))}
        </details>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled || source.status === "deleting"}
        onClick={() => {
          if (
            window.confirm(
              "Delete this source and all its transcripts? Published scenarios retain their brief and provenance, not this recording.",
            )
          )
            void onAction("Deleting source…", () =>
              api(url, { revision: source.revision, draftRevision }, "DELETE"),
            );
        }}
      >
        <Trash2 size={14} />
        Delete source
      </Button>
    </article>
  );
}
