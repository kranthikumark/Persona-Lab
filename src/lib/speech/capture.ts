import { encodeWav } from "./wav";
import { MAX_AUDIO_SECONDS, SAMPLE_RATE } from "./contracts";
export type PcmCapture = { stop: () => Uint8Array; cancel: () => void };
export async function capturePcm(
  signal: AbortSignal,
  onLimit: () => void,
  onEnded: () => void,
): Promise<PcmCapture> {
  if (
    !window.isSecureContext ||
    !navigator.mediaDevices?.getUserMedia ||
    !window.AudioContext
  )
    throw new Error(
      "Microphone recording needs HTTPS or localhost and a supported browser. Continue in text.",
    );
  let context: AudioContext | undefined,
    stream: MediaStream | undefined,
    node: AudioWorkletNode | undefined,
    source: MediaStreamAudioSourceNode | undefined,
    gain: GainNode | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  let chunks: Float32Array[] = [],
    count = 0,
    closed = false;
  const ended = () => {
    if (!closed) {
      cleanup();
      onEnded();
    }
  };
  const cleanup = () => {
    closed = true;
    if (timer) clearTimeout(timer);
    signal.removeEventListener("abort", cleanup);
    if (node) {
      node.port.onmessage = null;
      node.port.close();
      node.disconnect();
      node = undefined;
    }
    source?.disconnect();
    source = undefined;
    gain?.disconnect();
    gain = undefined;
    stream?.getTracks().forEach((track) => {
      track.removeEventListener("ended", ended);
      track.stop();
    });
    if (context?.state !== "closed") void context?.close().catch(() => {});
    chunks.forEach((chunk) => chunk.fill(0));
    chunks = [];
  };
  try {
    try {
      context = new AudioContext({ sampleRate: SAMPLE_RATE });
    } catch {
      context = new AudioContext();
    }
    signal.addEventListener("abort", cleanup, { once: true });
    if (signal.aborted) throw new Error("Recording cancelled.");
    await context.resume();
    if (signal.aborted) throw new Error("Recording cancelled.");
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });
    if (signal.aborted) {
      cleanup();
      throw new Error("Recording cancelled.");
    }
    if (!context.audioWorklet)
      throw new Error(
        "Audio recording is unavailable in this browser. Continue in text.",
      );
    await context.audioWorklet.addModule("/audio/pcm-recorder.js");
    if (signal.aborted) {
      cleanup();
      throw new Error("Recording cancelled.");
    }
    source = context.createMediaStreamSource(stream);
    node = new AudioWorkletNode(context, "persona-pcm-recorder");
    gain = context.createGain();
    gain.gain.value = 0;
    source.connect(node);
    node.connect(gain);
    gain.connect(context.destination);
    stream
      .getAudioTracks()
      .forEach((track) => track.addEventListener("ended", ended));
    node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      if (closed || !(event.data instanceof Float32Array)) return;
      const remaining =
        Math.floor(context!.sampleRate * MAX_AUDIO_SECONDS) - count;
      const chunk = event.data.subarray(0, Math.max(0, remaining));
      chunks.push(chunk);
      count += chunk.length;
      if (remaining <= event.data.length) onLimit();
    };
    timer = setTimeout(onLimit, MAX_AUDIO_SECONDS * 1000);
    signal.addEventListener("abort", cleanup, { once: true });
    return {
      cancel: cleanup,
      stop: () => {
        if (closed) throw new Error("Recording already stopped. Record again.");
        const samples = new Float32Array(count);
        let offset = 0;
        for (const chunk of chunks) {
          samples.set(chunk, offset);
          offset += chunk.length;
        }
        try {
          return encodeWav(samples, context!.sampleRate);
        } finally {
          samples.fill(0);
          cleanup();
        }
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}
