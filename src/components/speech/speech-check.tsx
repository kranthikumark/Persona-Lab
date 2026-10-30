"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Mic, Square, Trash2, Volume2 } from "lucide-react";
import { Shell } from "../shell";
import { Button } from "../ui/button";
import { api, type SessionView } from "@/lib/client";
import { capturePcm, type PcmCapture } from "@/lib/speech/capture";
import {
  newConsent,
  validConsent,
  type SpeechConsent,
  type SpeechTranscript,
} from "@/lib/speech/contracts";
import { responseLength } from "@/lib/response-length";
import { validateWav } from "@/lib/speech/wav";

type Phase =
  | "idle"
  | "permission"
  | "recording"
  | "recorded"
  | "transcribing"
  | "review"
  | "confirmed";
export function SpeechCheck({ sessionId }: { sessionId: string }) {
  const search = useSearchParams(),
    branch = search.get("branch");
  return (
    <SpeechCheckRoom
      key={`${sessionId}:${branch}:${search.get("return")}`}
      sessionId={sessionId}
      branch={branch}
      returnOriginal={branch === null || search.get("return") === "original"}
    />
  );
}
function SpeechCheckRoom({
  sessionId,
  branch,
  returnOriginal,
}: {
  sessionId: string;
  branch: string | null;
  returnOriginal: boolean;
}) {
  const [view, setView] = useState<SessionView | null>(null),
    [available, setAvailable] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [phase, setPhase] = useState<Phase>("idle");
  const [consent, setConsent] = useState<SpeechConsent | null>(null),
    [audio, setAudio] = useState<Uint8Array | null>(null),
    [audioUrl, setAudioUrl] = useState("");
  const [text, setText] = useState(""),
    [result, setResult] = useState<SpeechTranscript | null>(null),
    [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [voiceUri, setVoiceUri] = useState(""),
    [speaking, setSpeaking] = useState(false);
  const urlRef = useRef("");
  const playbackJob = useRef(0);
  const active = useRef(true),
    job = useRef(0),
    controller = useRef<AbortController | null>(null),
    capture = useRef<PcmCapture | null>(null),
    recordingPlayer = useRef<HTMLAudioElement | null>(null),
    readbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const length = responseLength(text);
  const stopPlayback = useCallback(() => {
    playbackJob.current++;
    window.speechSynthesis?.cancel();
    if (readbackTimer.current) clearTimeout(readbackTimer.current);
    recordingPlayer.current?.pause();
    if (active.current) setSpeaking(false);
  }, []);
  const discard = useCallback(() => {
    job.current++;
    controller.current?.abort();
    capture.current?.cancel();
    capture.current = null;
    stopPlayback();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
    }
    if (active.current) {
      setAudio(null);
      setAudioUrl("");
      setText("");
      setResult(null);
      setPhase("idle");
      setMessage(
        "Recording and transcript discarded. Text practice is available.",
      );
    }
  }, [stopPlayback]);
  useEffect(() => {
    active.current = true;
    const onHidden = () => {
      if (document.visibilityState === "hidden") discard();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", discard);
    return () => {
      active.current = false;
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", discard);
      discard();
    };
  }, [discard, stopPlayback]);
  useEffect(() => {
    let current = true;
    Promise.all([
      api<SessionView>(
        `/api/sessions/${sessionId}${branch ? `?branch=${encodeURIComponent(branch)}` : ""}`,
      ),
      api<{ speech: { checkAvailable: boolean } }>("/api/capabilities"),
    ])
      .then(([session, capabilities]) => {
        if (current) {
          setView(session);
          setAvailable(capabilities.speech.checkAvailable);
        }
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [sessionId, branch]);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () =>
      setVoices(
        synth
          .getVoices()
          .filter((v) => v.localService && /^en(?:-|$)/i.test(v.lang)),
      );
    synth.addEventListener("voiceschanged", update);
    void Promise.resolve().then(update);
    return () => synth.removeEventListener("voiceschanged", update);
  }, []);
  const stopRecording = useCallback(() => {
    if (!capture.current) return;
    try {
      const bytes = capture.current.stop();
      validateWav(bytes);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(
        new Blob([Uint8Array.from(bytes)], { type: "audio/wav" }),
      );
      setAudioUrl(urlRef.current);
      setAudio(bytes);
      setPhase("recorded");
      setMessage(
        "Microphone stopped. Listen locally or choose Transcribe to send this recording to Meta.",
      );
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    } finally {
      capture.current = null;
    }
  }, []);
  async function record() {
    if (!consent) return;
    try {
      validConsent(consent);
    } catch {
      setConsent(null);
      setError("Consent expired. Agree again before recording.");
      return;
    }
    stopPlayback();
    setError("");
    setMessage("");
    setText("");
    setResult(null);
    setAudio(null);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setAudioUrl("");
    setPhase("permission");
    const token = ++job.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    try {
      const recording = await capturePcm(abort.signal, stopRecording, () => {
        if (active.current && job.current === token) {
          setPhase("idle");
          setAudio(null);
          setMessage(
            "Microphone disconnected. Recording discarded; continue in text or record again.",
          );
        }
      });
      if (!active.current || job.current !== token) {
        recording.cancel();
        return;
      }
      capture.current = recording;
      setPhase("recording");
      setMessage(
        "Recording · maximum 60 seconds. Nothing is uploaded until you choose Transcribe.",
      );
    } catch (e) {
      if (active.current && job.current === token) {
        setPhase("idle");
        setError(
          (e as Error).name === "NotAllowedError"
            ? "Microphone permission was denied. Text practice remains available; your conversation is unchanged."
            : (e as Error).message,
        );
      }
    }
  }
  async function transcribe() {
    if (!audio || !consent || !view) return;
    const token = ++job.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError("");
    setMessage("");
    setPhase("transcribing");
    stopPlayback();
    try {
      const response = await fetch(
        `/api/branches/${view.branch.id}/speech/transcribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "audio/wav",
            "x-persona-revision": String(view.branch.revision),
            "x-persona-speech-consent": JSON.stringify(validConsent(consent)),
          },
          body: Uint8Array.from(audio),
          signal: abort.signal,
          cache: "no-store",
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ?? "Speech processing failed. Continue in text.",
        );
      if (!active.current || job.current !== token) return;
      if (
        data.branchId !== view.branch.id ||
        data.revision !== view.branch.revision ||
        data.consentId !== consent.id
      )
        throw new Error(
          "Transcript belongs to a different request. Record again.",
        );
      setResult(data);
      setText(data.text);
      setPhase("review");
      setMessage(
        "Review every word, especially amounts and policy terms. This transcript has not been sent as a conversation turn.",
      );
    } catch (e) {
      if (active.current && job.current === token) {
        setPhase("recorded");
        setError((e as Error).message);
      }
    }
  }
  function readBack() {
    if (phase !== "confirmed") return;
    stopPlayback();
    const voice = voices.find((v) => v.voiceURI === voiceUri) ?? voices[0];
    if (!voice || !voice.localService) return;
    const playbackToken = playbackJob.current;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      const completed = () => {
        if (playbackJob.current !== playbackToken) return;
        if (readbackTimer.current) clearTimeout(readbackTimer.current);
        if (active.current) setSpeaking(false);
      };
      utterance.onend = completed;
      utterance.onerror = () => {
        if (playbackJob.current !== playbackToken) return;
        completed();
        if (active.current)
          setError(
            "Device playback failed. Read the confirmed transcript or try another local voice.",
          );
      };
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
      readbackTimer.current = setTimeout(() => {
        stopPlayback();
        if (active.current)
          setMessage("Playback stopped after its time limit.");
      }, 90000);
    } catch {
      setSpeaking(false);
      setError(
        "Device playback is unavailable. Your confirmed text is still available.",
      );
    }
  }
  const textHref = `/sessions/${sessionId}${!returnOriginal && view ? `?branch=${view.branch.id}` : ""}`;
  const enabled =
    available && (view?.settings?.practiceLocale ?? "en-IN") === "en-IN";
  return (
    <Shell page="Microphone check" mode={view?.provider} documentNavigation>
      <main className="studio-main speech-main" id="page-content" tabIndex={-1}>
        <a href={textHref} className="resume-link" onClick={discard}>
          <ArrowLeft size={16} /> Return to text practice
        </a>
        <section className="creator-intro">
          <span className="eyebrow accent-secondary">
            VOICE · LOCAL ACCEPTANCE
          </span>
          <h1>
            A little sound.
            <br />
            <em>A clearer conversation.</em>
          </h1>
          <p>
            Check your microphone, review Meta’s transcription, and hear your
            confirmed words with an installed device voice.
          </p>
        </section>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <p role="status">Checking your practice settings…</p>
        ) : !enabled ? (
          <div className="empty-state">
            <h2>Continue with text practice.</h2>
            <p>
              {view?.settings?.practiceLocale !== "en-IN"
                ? "This speech check is currently verified only for English API access. Hindi and Telugu speech are awaiting separate acceptance."
                : "Microphone checks need configured Meta access in localhost acceptance preview."}
            </p>
          </div>
        ) : (
          <div className="speech-grid">
            <section className="speech-panel" aria-labelledby="capture-title">
              <span className="eyebrow">01 · YOUR PERMISSION</span>
              <h2 id="capture-title">You control the microphone.</h2>
              <p>
                Record up to 60 seconds. Audio stays on this page until you
                choose <strong>Transcribe with Meta</strong>. The app saves no
                audio files or transcripts from this check. Meta processes
                uploaded audio under its API data policy; provider zero data
                retention has not been verified.
              </p>
              <p>
                Camera capture, recording retention and camera analysis are off.
                Leaving or hiding this page stops capture and discards the clip
                and transcript. Existing text drafts are preserved.
              </p>
              <label className="speech-consent">
                <input
                  type="checkbox"
                  checked={!!consent}
                  onChange={(e) => {
                    if (e.target.checked) setConsent(newConsent());
                    else {
                      setConsent(null);
                      discard();
                    }
                  }}
                />{" "}
                I agree to microphone capture and sending a recording to Meta
                when I choose Transcribe.
              </label>
              <div className="speech-actions">
                {["permission", "recording"].includes(phase) ? (
                  <>
                    <Button
                      onClick={stopRecording}
                      disabled={phase !== "recording"}
                    >
                      <Square size={16} /> Stop recording
                    </Button>
                    <Button variant="ghost" onClick={discard}>
                      Cancel microphone
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={record}
                    disabled={!consent || phase === "transcribing"}
                  >
                    <Mic size={16} />{" "}
                    {audio ? "Record again" : "Start microphone"}
                  </Button>
                )}
                {audio && phase !== "transcribing" && (
                  <Button
                    variant="secondary"
                    onClick={transcribe}
                    disabled={!consent}
                  >
                    Transcribe with Meta
                  </Button>
                )}
                {(audio || phase === "transcribing") && (
                  <Button variant="ghost" onClick={discard}>
                    <Trash2 size={15} />{" "}
                    {phase === "transcribing"
                      ? "Cancel transcription"
                      : "Discard recording"}
                  </Button>
                )}
              </div>
              {message && (
                <p role="status" className="speech-status">
                  {message}
                </p>
              )}
              {phase === "transcribing" && (
                <p role="status">Meta is transcribing your recording…</p>
              )}
              {audioUrl && (
                <div className="speech-local-audio">
                  <p>Listen to your original recording locally</p>
                  <audio
                    ref={recordingPlayer}
                    controls
                    src={audioUrl}
                    preload="none"
                    onPlay={() => {
                      playbackJob.current++;
                      if (readbackTimer.current)
                        clearTimeout(readbackTimer.current);
                      window.speechSynthesis?.cancel();
                      setSpeaking(false);
                    }}
                  />
                </div>
              )}
            </section>
            <section className="speech-panel" aria-labelledby="review-title">
              <span className="eyebrow">02 · REVIEW BEFORE USING</span>
              <h2 id="review-title">Your words, confirmed by you.</h2>
              <label htmlFor="speech-transcript">
                Editable English transcript
              </label>
              <textarea
                id="speech-transcript"
                lang="en-IN"
                rows={7}
                maxLength={2000}
                value={text}
                disabled={!result || phase === "transcribing"}
                onChange={(e) => {
                  stopPlayback();
                  setText(e.target.value);
                  setPhase("review");
                }}
                aria-describedby="speech-length"
              />
              <p id="speech-length" className="subtle-label">
                {length.wordCount} / 70 words ·{" "}
                {text
                  ? (length.error ?? "Ready for review")
                  : "Record and transcribe to begin"}
              </p>
              <Button
                onClick={() => {
                  stopPlayback();
                  setPhase("confirmed");
                  setMessage(
                    "Transcript confirmed for this check. No conversation turn has been created.",
                  );
                }}
                disabled={!result || !!length.error || phase !== "review"}
              >
                <Check size={16} />{" "}
                {phase === "confirmed"
                  ? "Transcript confirmed"
                  : "Confirm transcript"}
              </Button>
              {result && (
                <p className="subtle-label">
                  {(result.audioDurationMs / 1000).toFixed(1)} seconds of audio
                  · {(result.latencyMs / 1000).toFixed(2)} seconds provider
                  processing. Timing describes this request only.
                </p>
              )}
              <div className="speech-readback">
                <h3>Device playback</h3>
                <p>
                  Muse Voice Transcribe provides text, not synthesized speech.
                  Playback below uses an installed local English voice.
                  Availability and pronunciation depend on your device.
                </p>
                <label>
                  Installed English voice
                  <select
                    aria-label="Installed English voice"
                    value={voiceUri}
                    onChange={(e) => {
                      stopPlayback();
                      setVoiceUri(e.target.value);
                    }}
                    disabled={!voices.length}
                  >
                    <option value="">Default local voice</option>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} · {v.lang}
                      </option>
                    ))}
                  </select>
                </label>
                {!voices.length && (
                  <p>
                    No local English playback voice is available in this
                    browser. Text and original-recording playback remain
                    available.
                  </p>
                )}
                <div className="speech-actions">
                  <Button
                    variant="secondary"
                    onClick={readBack}
                    disabled={
                      phase !== "confirmed" || !voices.length || speaking
                    }
                  >
                    <Volume2 size={16} /> Read confirmed transcript
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={stopPlayback}
                    disabled={!speaking}
                  >
                    Stop playback
                  </Button>
                </div>
              </div>
            </section>
          </div>
        )}
        <p className="speech-footnote">
          This is a microphone and transcription check. Live spoken conversation
          and the speaking character are the next phase. Your conversation state
          and report scores do not change here.
        </p>
      </main>
    </Shell>
  );
}
