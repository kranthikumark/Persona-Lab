"use client";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Video, VideoOff, LoaderCircle } from "lucide-react";
import type { SimliClient } from "simli-client";
import { api, requestKey } from "@/lib/client";
import { wavToSimliPcm } from "@/lib/avatar/pcm";
import { waitForVideoFrame } from "@/lib/avatar/video-frame";
import { AvatarActivity, type AvatarCallbacks } from "@/lib/avatar/activity";
export type { AvatarCallbacks } from "@/lib/avatar/activity";
export type SimliHandle = {
  play: (messageId: string, callbacks: AvatarCallbacks) => Promise<void>;
  cancel: () => void;
};
export const SimliAvatar = forwardRef<
  SimliHandle,
  {
    branchId: string;
    revision: number;
    locale: string;
    onReady: (ready: boolean) => void;
    onVideoMode: (enabled: boolean) => void;
  }
>(function SimliAvatar(
  { branchId, revision, locale, onReady, onVideoMode },
  ref,
) {
  const video = useRef<HTMLVideoElement>(null),
    audio = useRef<HTMLAudioElement>(null);
  const client = useRef<SimliClient | null>(null);
  const lease = useRef<string | null>(null);
  const connection = useRef<AbortController | null>(null);
  const meter = useRef<{
    context: AudioContext;
    timer: ReturnType<typeof setInterval>;
  } | null>(null);
  const frameJob = useRef(0);
  const job = useRef(0),
    request = useRef<AbortController | null>(null);
  const activity = useRef(new AvatarActivity());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "ready">("idle");
  const [wanted, setWanted] = useState(false),
    [buffering, setBuffering] = useState(false);
  const [available, setAvailable] = useState(false),
    [custom, setCustom] = useState(false),
    [error, setError] = useState("");
  const cancel = useCallback(() => {
    frameJob.current++;
    setBuffering(false);
    const hadAudio = activity.current.cancel();
    request.current?.abort();
    request.current = null;
    if (audio.current) audio.current.muted = true;
    try {
      if (hadAudio) client.current?.ClearBuffer();
    } catch {
      /* Closed stream: the portrait remains available. */
    }
  }, []);
  const disconnect = useCallback(() => {
    job.current++;
    connection.current?.abort();
    connection.current = null;
    if (meter.current) {
      clearInterval(meter.current.timer);
      void meter.current.context.close().catch(() => {});
      meter.current = null;
    }
    const interrupted = activity.current.active;
    cancel();
    interrupted?.end();
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const previous = client.current;
    client.current = null;
    onReady(false);
    setStatus("idle");
    void previous?.stop().catch(() => {});
    for (const element of [video.current, audio.current]) {
      const stream = element?.srcObject;
      if (typeof MediaStream !== "undefined" && stream instanceof MediaStream)
        stream.getTracks().forEach((track) => track.stop());
      if (element) element.srcObject = null;
    }
    const previousLease = lease.current;
    lease.current = null;
    if (previousLease)
      void fetch(`/api/branches/${branchId}/avatar`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaseId: previousLease }),
        keepalive: true,
      }).catch(() => {});
  }, [branchId, cancel, onReady]);
  useEffect(() => {
    let active = true;
    const update = () => {
      void api<{
        avatar?: { configured: boolean; customFace: boolean };
        speech: { nativePlayback?: { voices: Record<string, string> } };
      }>("/api/capabilities")
        .then((result) => {
          if (!active) return;
          setAvailable(
            !!result.avatar?.configured &&
              !!result.speech.nativePlayback?.voices[locale],
          );
          setCustom(!!result.avatar?.customFace);
        })
        .catch(() => {});
    };
    update();
    window.addEventListener("focus", update);
    return () => {
      active = false;
      window.removeEventListener("focus", update);
    };
  }, [locale]);
  useEffect(() => {
    const leave = () => {
      onVideoMode(false);
      setWanted(false);
      disconnect();
    };
    const hidden = () => {
      if (document.hidden) leave();
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
      leave();
    };
  }, [disconnect, onVideoMode]);
  useImperativeHandle(
    ref,
    () => ({
      cancel,
      async play(messageId, callbacks) {
        cancel();
        const current = client.current;
        if (!current || status !== "ready")
          throw new Error("Video is disconnected");
        const ticket = job.current,
          controller = new AbortController();
        request.current = controller;
        const response = await fetch(
          `/api/branches/${branchId}/speech/playback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageId, revision }),
            signal: controller.signal,
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error("Reply audio unavailable");
        const pcm = wavToSimliPcm(new Uint8Array(await response.arrayBuffer()));
        if (
          ticket !== job.current ||
          controller.signal.aborted ||
          client.current !== current
        )
          throw new Error("Video request cancelled");
        setBuffering(true);
        // SDK startup already proves that video arrived. Reuse an existing
        // decoded frame; requiring a new idle frame for every reply can hang
        // a slow connection before any speech is even sent to the avatar.
        if (!video.current) throw new Error("Video is unavailable");
        await video.current.play();
        if (video.current.readyState < 2 || !video.current.videoWidth)
          await waitForVideoFrame(video.current, controller.signal);
        if (
          ticket !== job.current ||
          controller.signal.aborted ||
          client.current !== current
        )
          throw new Error("Video request cancelled");
        const replyCallbacks: AvatarCallbacks = {
          ...callbacks,
          start: () => {
            if (
              ticket !== job.current ||
              controller.signal.aborted ||
              activity.current.active !== replyCallbacks
            )
              return;
            const output = audio.current;
            if (!output) return;
            output.muted = false;
            void output
              .play()
              .then(() => {
                if (
                  controller.signal.aborted ||
                  activity.current.active !== replyCallbacks
                )
                  return;
                setBuffering(false);
                callbacks.start();
              })
              .catch(() => {
                if (
                  controller.signal.aborted ||
                  activity.current.active !== replyCallbacks
                )
                  return;
                cancel();
                callbacks.error();
                setError(
                  "Your browser paused avatar audio. Select Replay reply to try again.",
                );
              });
          },
          end: () => {
            frameJob.current++;
            setBuffering(false);
            if (audio.current) audio.current.muted = true;
            callbacks.end();
          },
        };
        // Signaling can outrun delayed WebRTC media. Do not let a batched
        // SILENT event cut the known PCM reply short while it is arriving.
        activity.current.set(replyCallbacks, pcm.length / 32 + 1000);
        for (let i = 0; i < pcm.length; i += 6000)
          current.sendAudioData(pcm.subarray(i, i + 6000));
      },
    }),
    [branchId, revision, status, cancel],
  );
  async function connect() {
    if (!available || status !== "idle" || !video.current || !audio.current)
      return;
    setError("");
    setWanted(true);
    onVideoMode(true);
    if (audio.current) audio.current.muted = true;
    setStatus("connecting");
    const ticket = ++job.current;
    // Observe received avatar audio while its element is muted. This graph is
    // never connected to speakers and never captures the learner microphone.
    try {
      const context = new AudioContext();
      void context.resume().catch(() => {});
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      const samples = new Float32Array(analyser.fftSize);
      let source: MediaStreamAudioSourceNode | undefined,
        voiced = false,
        quietSince = 0;
      const timer = setInterval(() => {
        if (ticket !== job.current) return;
        const stream = audio.current?.srcObject;
        if (
          !source &&
          stream instanceof MediaStream &&
          stream.getAudioTracks().length
        ) {
          try {
            source = context.createMediaStreamSource(stream);
            source.connect(analyser);
          } catch {
            return;
          }
        }
        if (
          !source ||
          context.state !== "running" ||
          !activity.current.active
        ) {
          voiced = false;
          quietSince = 0;
          return;
        }
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(
          samples.reduce((sum, v) => sum + v * v, 0) / samples.length,
        );
        if (rms > 0.003) {
          voiced = true;
          quietSince = 0;
          activity.current.speaking();
        } else if (voiced) {
          if (!quietSince) quietSince = Date.now();
          if (Date.now() - quietSince >= 700) {
            voiced = false;
            quietSince = 0;
            activity.current.silent();
          }
        }
      }, 50);
      meter.current = { context, timer };
    } catch {
      /* SDK media signals remain a fallback on unsupported devices. */
    }
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let failure =
      "Video could not connect. Check your Simli face, minutes and connection; voice practice remains available.";
    try {
      const controller = new AbortController();
      lease.current = requestKey();
      connection.current = controller;
      const response = await fetch(`/api/branches/${branchId}/avatar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, leaseId: lease.current }),
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        if (typeof data.error === "string") failure = data.error;
        throw new Error("Session refused");
      }
      if (ticket !== job.current) return;
      const { SimliClient, LogLevel } = await import("simli-client");
      if (ticket !== job.current) return;
      const stream = new SimliClient(
        data.session_token,
        video.current!,
        audio.current!,
        data.iceServers,
        LogLevel.CRITICAL,
        data.transport,
      );
      client.current = stream;
      stream.on("speaking", () => {
        if (
          ticket === job.current &&
          (!meter.current || meter.current.context.state !== "running")
        )
          activity.current.speaking();
      });
      stream.on("silent", () => {
        if (
          ticket === job.current &&
          (!meter.current || meter.current.context.state !== "running")
        )
          activity.current.silent();
      });
      stream.on("error", () => {
        if (ticket !== job.current) return;
        const previous = activity.current.active;
        disconnect();
        previous?.error();
        setError(
          "Video disconnected. Use spoken replies or enable video again.",
        );
      });
      stream.on("stop", () => {
        if (ticket !== job.current) return;
        const previous = activity.current.active;
        disconnect();
        previous?.end();
      });
      await Promise.race([
        stream.start(),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () =>
              reject(
                new Error(
                  "Video connection timed out. Try again or continue with voice.",
                ),
              ),
            60000,
          );
        }),
      ]);
      // SDK start resolves on its first presented frame. Requiring another
      // frame before revealing the video can stall a low-bandwidth stream.
      if (ticket !== job.current) {
        void stream.stop().catch(() => {});
        return;
      }
      onReady(true);
      setStatus("ready");
      timer.current = setTimeout(() => {
        disconnect();
        setError(
          "Video preview ended after two minutes. Your conversation is saved.",
        );
      }, 120000);
    } catch {
      if (ticket !== job.current) return;
      disconnect();
      setError(failure);
    } finally {
      if (deadline) clearTimeout(deadline);
    }
  }
  return (
    <div className={`simli-stage ${status}`} data-video-state={status}>
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label="Live AI avatar"
        onWaiting={() => {
          if (!activity.current.active) return;
          frameJob.current++;
          if (audio.current) audio.current.muted = true;
          setBuffering(true);
          activity.current.active.wait?.();
        }}
        onPlaying={() => {
          const active = activity.current.active;
          const controller = request.current;
          const frameTicket = ++frameJob.current;
          if (!active || !controller || !video.current) return;
          void waitForVideoFrame(video.current, controller.signal)
            .then(() => {
              if (
                frameTicket === frameJob.current &&
                activity.current.active === active &&
                !controller.signal.aborted
              )
                active.start();
            })
            .catch(() => {
              if (
                frameTicket !== frameJob.current ||
                controller.signal.aborted ||
                activity.current.active !== active
              )
                return;
              cancel();
              active.error();
              setError(
                "Video is not arriving. Retry video or choose Use voice only.",
              );
            });
        }}
      />
      <audio ref={audio} autoPlay muted />
      <div className="simli-controls">
        {status === "idle" ? (
          <button type="button" disabled={!available} onClick={connect}>
            <Video size={14} /> {wanted ? "Retry video" : "Enable video avatar"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setWanted(false);
              onVideoMode(false);
              disconnect();
            }}
          >
            {status === "connecting" ? (
              <LoaderCircle size={14} />
            ) : (
              <VideoOff size={14} />
            )}{" "}
            {status === "connecting" ? "Cancel connection" : "End video"}
          </button>
        )}
        {status === "idle" && wanted && (
          <button
            type="button"
            onClick={() => {
              setWanted(false);
              onVideoMode(false);
              setError("");
            }}
          >
            Use voice only
          </button>
        )}
      </div>
      {(status === "connecting" || buffering) && (
        <div className="simli-wait" role="status">
          <LoaderCircle size={18} /> Wait… receiving avatar video
        </div>
      )}
      {status === "ready" && (
        <span className="simli-identity">
          {custom
            ? "Configured avatar"
            : "Template avatar · different likeness"}
        </span>
      )}
      {status === "idle" && (
        <div className="simli-disclosure">
          {available
            ? "2-minute preview · AI reply audio is sent to Simli"
            : "Video setup pending · voice practice available"}
        </div>
      )}
      {error && (
        <div className="simli-error" role="status">
          {error}
        </div>
      )}
    </div>
  );
});
