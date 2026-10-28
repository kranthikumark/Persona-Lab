"use client";
import { useId, useRef, useState } from "react";
import { Download, FileText, Mail, MessageCircle, Share2 } from "lucide-react";
import type { EvaluationReport } from "@/lib/evaluation/rubric";

type Format = "pdf" | "docx";
export function ReportActions({
  branchId,
  reportId,
  report,
  stale,
}: {
  branchId: string;
  reportId: string;
  report: EvaluationReport;
  stale: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [open, setOpen] = useState(false),
    [format, setFormat] = useState<Format>("pdf");
  const [attachment, setAttachment] = useState<{
    id: string;
    file: File;
  } | null>(null);
  const cache = useRef(new Map<string, File>());
  const panel = useId();
  const ready = attachment?.id === reportId ? attachment.file : null;
  const subject = "PERSONA LAB practice report";
  const summary = `My PERSONA LAB practice report\nScore: ${report.overall ?? 0}/100\nEvidence coverage: ${report.assessedChecks}/10 checks\nThrough turn ${report.scope.throughTurn}, revision ${report.scope.revision}\nNext improvement: ${report.nextAction}\nThis is a limited practice rubric score, not a measure of real-world competence.`;
  async function fileFor(kind: Format) {
    const key = `${reportId}:${kind}`;
    const existing = cache.current.get(key);
    if (existing) return existing;
    const response = await fetch(
      `/api/branches/${branchId}/evaluation/export`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: kind, revision: report.scope.revision }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(
        body?.error ?? "The report could not be prepared. Please retry.",
      );
    }
    const file = new File(
      [await response.blob()],
      `persona-lab-report-r${report.scope.revision}.${kind}`,
      {
        type:
          kind === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    );
    cache.current.set(key, file);
    return file;
  }
  async function prepare(kind: Format, download: boolean) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const file = await fileFor(kind);
      if (download) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage(
          `${kind === "pdf" ? "PDF" : "Word"} report downloaded. You can attach it in email or WhatsApp.`,
        );
      } else {
        setAttachment({ id: reportId, file });
        setMessage(
          "Attachment ready. Open share options and choose your email or WhatsApp app.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!ready) return;
    // Keep the actual share invocation in a fresh click, after file preparation.
    if (!navigator.share || !navigator.canShare?.({ files: [ready] })) {
      setMessage(
        "File sharing is unavailable in this browser. Download the report, then attach it in email or WhatsApp.",
      );
      return;
    }
    setError("");
    try {
      await navigator.share({ files: [ready], title: subject });
      setMessage("Report handed to your sharing app. Confirm delivery there.");
    } catch (e) {
      if ((e as Error).name === "AbortError")
        setMessage("Sharing cancelled. Your report is still ready.");
      else
        setError(
          "Sharing could not open. Download the report and attach it manually.",
        );
    }
  }
  return (
    <section className="report-actions" aria-label="Download and share report">
      <div className="report-action-buttons">
        <button
          className="button button-secondary button-sm"
          disabled={busy || stale}
          onClick={() => prepare("pdf", true)}
        >
          <Download size={15} aria-hidden="true" />
          Download PDF
        </button>
        <button
          className="button button-secondary button-sm"
          disabled={busy || stale}
          onClick={() => prepare("docx", true)}
        >
          <FileText size={15} aria-hidden="true" />
          Download Word
        </button>
        <button
          className="button button-secondary button-sm"
          disabled={busy || stale}
          aria-expanded={open}
          aria-controls={panel}
          onClick={() => setOpen(!open)}
        >
          <Share2 size={15} aria-hidden="true" />
          Share report
        </button>
      </div>
      {stale && (
        <p className="report-share-note">
          Evaluate the current revision before exporting or sharing.
        </p>
      )}
      {busy && (
        <p role="status" className="report-share-note">
          Preparing your report…
        </p>
      )}
      {message && (
        <p role="status" className="report-share-note">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {open && !stale && (
        <div id={panel} className="report-share-panel">
          <h3>Share your report</h3>
          <p>
            Prepare an attachment, then choose an app from your device’s share
            options.
          </p>
          <div className="report-action-buttons">
            <label className="report-format-label">
              Attachment format
              <select
                value={format}
                disabled={busy}
                onChange={(e) => {
                  setFormat(e.target.value as Format);
                  setAttachment(null);
                }}
              >
                <option value="pdf">PDF</option>
                <option value="docx">Word document</option>
              </select>
            </label>
            <button
              className="button button-secondary button-sm"
              disabled={busy}
              onClick={() => prepare(format, false)}
            >
              Prepare attachment
            </button>
            {ready && (
              <button
                className="button button-primary button-sm"
                onClick={share}
              >
                Open share options
              </button>
            )}
          </div>
          <div className="report-summary-links">
            <a
              className="button button-ghost button-sm"
              href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`}
            >
              <Mail size={15} aria-hidden="true" />
              Email summary
            </a>
            <a
              className="button button-ghost button-sm"
              href={`https://wa.me/?text=${encodeURIComponent(summary)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={15} aria-hidden="true" />
              WhatsApp summary
            </a>
          </div>
          <p className="report-share-note">
            Summary links share text only. Download the PDF or Word report and
            attach it manually if your browser cannot share files. Your private
            session link is not included.
          </p>
        </div>
      )}
    </section>
  );
}
