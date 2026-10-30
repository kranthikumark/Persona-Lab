"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Square, RotateCcw } from "lucide-react";
import { Button } from "../ui/button";
import { selectLocalVoice } from "@/lib/speech/playback";

type Reply = { id: string; content: string };
export function ReplyPlayback({
  locale,
  message,
  blocked,
}: {
  locale: "en-IN" | "hi-IN" | "te-IN";
  message: Reply | null;
  blocked: boolean;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [notice, setNotice] = useState("");
  const seen = useRef<string | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voice = selectLocalVoice(voices, locale);
  const cancel = useCallback(() => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);
  const speak = useCallback(
    (reply: Reply) => {
      cancel();
      if (!voice || !window.speechSynthesis || !reply.content.trim()) return;
      const ticket = generation.current;
      let utterance: SpeechSynthesisUtterance;
      try {
        utterance = new SpeechSynthesisUtterance(reply.content);
        utterance.voice = voice;
        utterance.lang = voice.lang;
        utterance.rate = 1;
      } catch {
        setNotice(
          "Device playback is unavailable. Your reply is available in the transcript.",
        );
        return;
      }
      const finish = () => {
        if (ticket !== generation.current) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        setSpeaking(false);
      };
      utterance.onend = finish;
      utterance.onerror = () => {
        if (ticket !== generation.current) return;
        finish();
        setNotice(
          "Playback could not start. Select Replay reply or continue reading.",
        );
      };
      setNotice("");
      setSpeaking(true);
      timer.current = setTimeout(() => {
        if (ticket !== generation.current) return;
        cancel();
        setNotice(
          "Playback stopped after its time limit. Your reply is available in the transcript.",
        );
      }, 90000);
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        cancel();
        setNotice(
          "Playback is unavailable. Your reply is available in the transcript.",
        );
      }
    },
    [voice, cancel],
  );
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => setVoices(synth.getVoices());
    synth.addEventListener("voiceschanged", update);
    void Promise.resolve().then(update);
    return () => synth.removeEventListener("voiceschanged", update);
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
        disabled={!voice || blocked}
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
      {speaking ? (
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
        voice &&
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
      <small role="status">
        {notice ||
          (speaking
            ? "Priya is speaking…"
            : voice
              ? "Uses an installed device voice."
              : `No installed ${locale === "hi-IN" ? "Hindi" : locale === "te-IN" ? "Telugu" : "English"} voice is available. Install one in device settings to hear replies.`)}
      </small>
    </div>
  );
}
