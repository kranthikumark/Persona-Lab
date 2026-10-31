"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  Square,
  X,
  Settings2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "../ui/button";
import { capturePcm, type PcmCapture } from "@/lib/speech/capture";
import {
  newConsent,
  validConsent,
  type SpeechConsent,
} from "@/lib/speech/contracts";
import { validateWav } from "@/lib/speech/wav";
import {
  voiceAllowed,
  rememberVoiceChoice,
  receiveVoiceChoice,
  VOICE_CHOICE_KEY,
} from "@/lib/speech/choice";
import type { CapturePhase as Phase } from "@/lib/speech/voice-stage";
export function ComposerSpeech({
  branchId,
  locale,
  revision,
  busy,
  onTranscript,
  onActivity,
  onPhase,
}: {
  branchId: string;
  locale: "en-IN" | "hi-IN" | "te-IN";
  revision: number;
  busy: boolean;
  onTranscript: (text: string, receipt: string) => void;
  onActivity: (active: boolean) => void;
  onPhase: (phase: Phase) => void;
}) {
  const search = useSearchParams();
  const [available, setAvailable] = useState(false),
    [phase, setPhase] = useState<Phase>("idle"),
    [ask, setAsk] = useState(search.get("microphone") === "1"),
    [settings, setSettings] = useState(false),
    [allowed, setAllowed] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [seconds, setSeconds] = useState(0),
    [retry, setRetry] = useState(false);
  useEffect(() => {
    onPhase(phase);
  }, [phase, onPhase]);
  useEffect(() => () => onPhase("idle"), [onPhase]);
  const capture = useRef<PcmCapture | null>(null),
    controller = useRef<AbortController | null>(null),
    job = useRef(0),
    active = useRef(true),
    clip = useRef<Uint8Array | null>(null),
    grant = useRef<SpeechConsent | null>(null);
  const discard = useCallback(() => {
    job.current++;
    controller.current?.abort();
    capture.current?.cancel();
    capture.current = null;
    clip.current = null;
    grant.current = null;
    onActivity(false);
    if (active.current) {
      setPhase("idle");
      setRetry(false);
    }
  }, [onActivity]);
  useEffect(() => {
    let current = true;
    api<{ speech: { locales: { locale: string; transcription: string }[] } }>(
      "/api/capabilities",
    )
      .then((r) => {
        if (current) {
          setAvailable(
            r.speech.locales.some(
              (entry) =>
                entry.locale === locale &&
                entry.transcription === "acceptance_preview",
            ),
          );
          setAllowed(voiceAllowed());
        }
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [locale]);
  useEffect(() => {
    if (search.get("microphone") === "1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("microphone");
      window.history.replaceState(window.history.state, "", url.toString());
    }
  }, [search]);
  useEffect(() => {
    active.current = true;
    const hidden = () => {
      if (document.visibilityState === "hidden") {
        discard();
        setMessage("Recording cancelled. Your draft is unchanged.");
      }
    };
    const changed = () => {
      const choice = voiceAllowed();
      setAllowed(choice);
      if (!choice) discard();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === VOICE_CHOICE_KEY || event.key === null) {
        receiveVoiceChoice(event.newValue);
        changed();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", discard);
    window.addEventListener("storage", storage);
    window.addEventListener("persona-voice-choice", changed);
    return () => {
      active.current = false;
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", discard);
      window.removeEventListener("storage", storage);
      window.removeEventListener("persona-voice-choice", changed);
      discard();
    };
  }, [discard]);
  useEffect(() => {
    if (phase !== "recording") return;
    const start = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.min(60, Math.floor((Date.now() - start) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [phase]);
  async function transcribe(bytes: Uint8Array, consent: SpeechConsent) {
    const token = ++job.current,
      abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setPhase("transcribing");
    setError("");
    setMessage("");
    setRetry(false);
    onActivity(true);
    try {
      const response = await fetch(
        `/api/branches/${branchId}/speech/transcribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "audio/wav",
            "x-persona-revision": String(revision),
            "x-persona-speech-consent": JSON.stringify(validConsent(consent)),
          },
          body: Uint8Array.from(bytes),
          signal: abort.signal,
          cache: "no-store",
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error ?? "Couldn’t transcribe. Try again or type your response.",
        );
      if (!active.current || job.current !== token) return;
      if (
        data.branchId !== branchId ||
        data.revision !== revision ||
        data.consentId !== consent.id ||
        typeof data.text !== "string" ||
        !data.receipt
      )
        throw new Error(
          "Couldn’t use this recording. Please record a shorter response.",
        );
      onTranscript(data.text, data.receipt);
      clip.current = null;
      grant.current = null;
      setPhase("idle");
      setMessage("Added to your draft. Edit if needed, then send.");
      onActivity(false);
    } catch (e) {
      if (active.current && job.current === token) {
        setPhase("idle");
        setError((e as Error).message);
        setRetry(true);
        onActivity(false);
      }
    }
  }
  function stop() {
    if (!capture.current || !grant.current) return;
    try {
      const bytes = capture.current.stop();
      capture.current = null;
      validateWav(bytes);
      clip.current = bytes;
      void transcribe(bytes, grant.current);
    } catch (e) {
      discard();
      setError((e as Error).message);
    }
  }
  async function record() {
    discard();
    setError("");
    setMessage("");
    setAsk(false);
    setSettings(false);
    setSeconds(0);
    const consent = newConsent();
    grant.current = consent;
    const token = ++job.current,
      abort = new AbortController();
    controller.current = abort;
    setPhase("permission");
    window.dispatchEvent(new Event("persona-microphone-start"));
    onActivity(true);
    try {
      const recording = await capturePcm(
        abort.signal,
        () => {
          if (job.current === token) stop();
        },
        () => {
          if (active.current && job.current === token) {
            discard();
            setError("Microphone disconnected. You can still type.");
          }
        },
      );
      if (!active.current || job.current !== token) {
        recording.cancel();
        return;
      }
      capture.current = recording;
      setPhase("recording");
    } catch (e) {
      if (active.current && job.current === token) {
        discard();
        setError(
          (e as Error).name === "NotAllowedError"
            ? "Microphone blocked. Allow it in your browser settings, or type your response."
            : (e as Error).message,
        );
      }
    }
  }
  function speak() {
    const policy =
      (
        document as Document & {
          permissionsPolicy?: { allowsFeature: (name: string) => boolean };
          featurePolicy?: { allowsFeature: (name: string) => boolean };
        }
      ).permissionsPolicy ??
      (
        document as Document & {
          featurePolicy?: { allowsFeature: (name: string) => boolean };
        }
      ).featurePolicy;
    if (policy && !policy.allowsFeature("microphone")) {
      const url = new URL(window.location.href);
      url.searchParams.set("microphone", "1");
      window.location.assign(url.toString());
      return;
    }
    if (voiceAllowed()) void record();
    else {
      setAsk(true);
      setSettings(false);
      setError("");
      setMessage("");
    }
  }
  return available ? (
    <div className="inline-voice-input">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={busy || phase !== "idle"}
        onClick={speak}
      >
        <Mic size={16} aria-hidden="true" /> Speak response
      </Button>
      {phase === "recording" && (
        <>
          <Button type="button" size="sm" className="voice-stop" onClick={stop}>
            <Square size={14} aria-hidden="true" /> Stop recording
          </Button>
          <span className="inline-recording" role="status">
            <span className="recording-dot" aria-hidden="true" />
            Recording{" "}
            <span aria-hidden="true">
              {String(seconds).padStart(2, "0")} / 60s
            </span>
          </span>
        </>
      )}
      {phase === "permission" && (
        <span className="inline-voice-status" role="status">
          Connecting microphone…
        </span>
      )}
      {phase === "transcribing" && (
        <span className="inline-voice-status" role="status">
          <LoaderCircle size={14} className="spin" aria-hidden="true" />
          Transcribing…
        </span>
      )}
      {phase !== "idle" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            discard();
            setMessage("Cancelled. Your draft is unchanged.");
          }}
        >
          <X size={14} aria-hidden="true" />
          {phase === "transcribing"
            ? "Cancel transcription"
            : "Cancel recording"}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Voice settings"
        disabled={busy}
        onClick={() => {
          setSettings(!settings);
          setAsk(false);
        }}
      >
        <Settings2 size={14} aria-hidden="true" />
      </Button>
      {ask && !allowed && (
        <div
          className="inline-voice-permission"
          role="region"
          aria-label="Voice permission"
        >
          <p>
            Stopping sends your recording to Meta and adds the transcript to
            your draft. Audio isn’t saved by this app. Remember this choice in
            this browser.
          </p>
          <div>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                rememberVoiceChoice(true);
                void record();
              }}
            >
              Allow and speak
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAsk(false)}
            >
              Not now
            </Button>
          </div>
        </div>
      )}
      {settings && (
        <div
          className="inline-voice-permission"
          role="region"
          aria-label="Voice input settings"
        >
          <p>
            {allowed
              ? "Voice input is allowed in this browser. Stop transcribes into your draft; Send stays under your control."
              : "Voice input is off. Your next click on Speak response will ask for permission."}
          </p>
          {allowed && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                rememberVoiceChoice(false);
                discard();
                setAsk(false);
                setSettings(false);
                setMessage("Voice input turned off. Your draft is kept.");
              }}
            >
              Turn off voice input
            </Button>
          )}
        </div>
      )}
      {message && phase === "idle" && (
        <span className="inline-voice-note" role="status">
          {message}
        </span>
      )}
      {error && (
        <div className="inline-voice-error" role="alert">
          {error}
          {retry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (clip.current && grant.current)
                  void transcribe(clip.current, grant.current);
              }}
            >
              <RotateCcw size={13} aria-hidden="true" />
              Retry transcription
            </Button>
          )}
        </div>
      )}
    </div>
  ) : null;
}
