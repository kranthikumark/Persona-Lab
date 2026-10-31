"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Volume2, VolumeX, Square, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import { api } from "@/lib/client";
import { selectLocalVoice } from "@/lib/speech/playback";

import type { PlaybackPhase } from "@/lib/speech/voice-stage";
import type { SimliHandle } from "./simli-avatar";
type Reply = { id: string; content: string };
export function ReplyPlayback({
  locale,
  message,
  blocked,
  onPhase,
  branchId,
  revision,
  avatarRef,
  avatarReady,
  videoMode,
}: {
  locale: "en-IN" | "hi-IN" | "te-IN";
  message: Reply | null;
  blocked: boolean;
  onPhase: (phase: PlaybackPhase) => void;
  branchId: string;
  revision: number;
  avatarRef: RefObject<SimliHandle | null>;
  avatarReady: boolean;
  videoMode: boolean;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState("");
  const [nativeVoice, setNativeVoice] = useState("");
  const nativeAudio = useRef<HTMLAudioElement | null>(null);
  const nativeUrl = useRef<string | null>(null);
  const nativeRequest = useRef<AbortController | null>(null);
  const seen = useRef<string | null>(null);
  const generation = useRef(0);
  const queued = useRef<Reply | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voice = selectLocalVoice(voices, locale);
  const cancel = useCallback(() => {
    queued.current = null;
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    window.speechSynthesis?.cancel();
    avatarRef.current?.cancel();
    nativeRequest.current?.abort();
    nativeRequest.current = null;
    nativeAudio.current?.pause();
    nativeAudio.current = null;
    if (nativeUrl.current) URL.revokeObjectURL(nativeUrl.current);
    nativeUrl.current = null;
    setSpeaking(false);
    setPreparing(false);
    onPhase("idle");
  }, [onPhase, avatarRef]);
  const speak = useCallback(
    (reply: Reply) => {
      cancel();
      if ((!voice && !nativeVoice && !videoMode) || !reply.content.trim())
        return;
      const ticket = generation.current;
      const finish = () => {
        if (ticket !== generation.current) return;
        generation.current++;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setSpeaking(false);
        setPreparing(false);
        onPhase("idle");
        nativeAudio.current = null;
        if (nativeUrl.current) URL.revokeObjectURL(nativeUrl.current);
        nativeUrl.current = null;
      };
      const started = () => {
        if (ticket !== generation.current || document.hidden) return;
        setPreparing(false);
        setSpeaking(true);
        onPhase("speaking");
      };
      const paused = () => {
        if (ticket !== generation.current) return;
        cancel();
        setNotice(
          "Playback paused by your device. Select Replay reply to listen again.",
        );
      };
      const failed = () => {
        if (ticket !== generation.current) return;
        finish();
        setNotice(
          "Playback could not start. Select Replay reply or continue reading.",
        );
      };
      setNotice("");
      setPreparing(true);
      onPhase("preparing");
      timer.current = setTimeout(() => {
        if (ticket !== generation.current) return;
        cancel();
        setNotice(
          "Playback stopped after its time limit. Your reply is available in the transcript.",
        );
      }, 90000);
      if (videoMode && !avatarReady) {
        queued.current = reply;
        return;
      }
      if (videoMode && avatarRef.current) {
        void avatarRef.current
          .play(reply.id, {
            start: started,
            end: finish,
            error: failed,
            wait: () => {
              if (ticket !== generation.current) return;
              setSpeaking(false);
              setPreparing(true);
              onPhase("preparing");
            },
          })
          .catch(() => {
            if (ticket !== generation.current) return;
            cancel();
            setNotice(
              "Video reply could not play. End video to use device speech, or try Replay.",
            );
          });
        return;
      }
      if (videoMode) {
        failed();
        return;
      }
      if (!voice && nativeVoice) {
        const controller = new AbortController();
        nativeRequest.current = controller;
        void (async () => {
          try {
            const response = await fetch(
              `/api/branches/${branchId}/speech/playback`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messageId: reply.id, revision }),
                signal: controller.signal,
                cache: "no-store",
              },
            );
            if (!response.ok) throw new Error("Local audio unavailable");
            const blob = await response.blob();
            if (ticket !== generation.current) return;
            if (
              blob.type !== "audio/wav" ||
              blob.size < 44 ||
              blob.size > 90 * 48000 + 8192
            )
              throw new Error("Invalid audio");
            const url = URL.createObjectURL(blob);
            nativeUrl.current = url;
            const audio = new Audio(url);
            nativeAudio.current = audio;
            audio.onplaying = started;
            audio.onended = finish;
            audio.onerror = failed;
            audio.onpause = () => {
              if (!audio.ended) paused();
            };
            await audio.play();
          } catch {
            if (ticket !== generation.current) return;
            cancel();
            setNotice(
              "Local audio could not play. Select Replay reply to try again, or continue reading.",
            );
          }
        })();
        return;
      }
      try {
        const utterance = new SpeechSynthesisUtterance(reply.content);
        utterance.voice = voice!;
        utterance.lang = voice!.lang;
        utterance.rate = 1;
        utterance.onstart = started;
        utterance.onpause = paused;
        utterance.onend = finish;
        utterance.onerror = failed;
        window.speechSynthesis.speak(utterance);
      } catch {
        cancel();
        setNotice(
          "Playback is unavailable. Your reply is available in the transcript.",
        );
      }
    },
    [
      voice,
      nativeVoice,
      branchId,
      revision,
      cancel,
      onPhase,
      avatarReady,
      videoMode,
      avatarRef,
    ],
  );
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) cancel();
    });
    return () => {
      active = false;
    };
  }, [videoMode, cancel]);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active && videoMode && avatarReady && queued.current && !blocked)
        speak(queued.current);
    });
    return () => {
      active = false;
    };
  }, [videoMode, avatarReady, blocked, speak]);
  useEffect(() => {
    let active = true;
    api<{ speech: { nativePlayback?: { voices: Record<string, string> } } }>(
      "/api/capabilities",
    )
      .then((result) => {
        if (active)
          setNativeVoice(result.speech.nativePlayback?.voices[locale] ?? "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [locale]);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => setVoices(synth.getVoices());
    synth.addEventListener("voiceschanged", update);
    window.addEventListener("focus", update);
    void Promise.resolve().then(update);
    return () => {
      synth.removeEventListener("voiceschanged", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  useEffect(() => {
    const stop = () => cancel();
    const hidden = () => {
      if (document.hidden) stop();
    };
    window.addEventListener("pagehide", stop);
    window.addEventListener("persona-microphone-start", stop);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("persona-microphone-start", stop);
      document.removeEventListener("visibilitychange", hidden);
      cancel();
    };
  }, [cancel]);
  useEffect(() => {
    let active = true;
    // Defer browser effects so cleanup also prevents Strict Mode duplicate playback.
    void Promise.resolve().then(() => {
      if (!active) return;
      if (blocked) {
        cancel();
        return;
      }
      if (!message || seen.current === message.id) return;
      const first = seen.current === null;
      seen.current = message.id;
      if (!first && enabled && !document.hidden) speak(message);
    });
    return () => {
      active = false;
    };
  }, [message, blocked, enabled, speak, cancel]);
  return (
    <div className="reply-playback" role="group" aria-label="Spoken AI replies">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={enabled}
        disabled={(!voice && !nativeVoice && !videoMode) || blocked}
        onClick={() => {
          cancel();
          setEnabled(!enabled);
          setNotice("");
          if (!enabled && message) {
            seen.current = message.id;
            speak(message);
          }
        }}
      >
        {enabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        Auto speak replies {enabled ? "on" : "off"}
      </Button>
      {speaking || preparing ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            cancel();
            setNotice("Playback stopped.");
          }}
        >
          <Square size={13} /> Stop reply
        </Button>
      ) : (
        (voice || nativeVoice || videoMode) &&
        message && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={blocked}
            onClick={() => speak(message)}
          >
            <RotateCcw size={13} /> Replay reply
          </Button>
        )
      )}
      <small aria-live={notice || (preparing && videoMode) ? "polite" : "off"}>
        {notice ||
          (preparing
            ? videoMode
              ? "Wait… receiving avatar video"
              : "Preparing Priya’s voice…"
            : speaking
              ? "Priya is speaking…"
              : voice
                ? "Uses an installed device voice."
                : nativeVoice
                  ? `Uses ${nativeVoice} installed on this Mac.`
                  : `No installed ${locale === "hi-IN" ? "Hindi" : locale === "te-IN" ? "Telugu" : "English"} voice is available. Install one in device settings to hear replies.`)}
      </small>
      {(speaking || preparing) && message && (
        <details className="voice-caption" open>
          <summary>Priya’s reply · captions</summary>
          <p lang={locale} tabIndex={0}>
            {message.content}
          </p>
        </details>
      )}
    </div>
  );
}
