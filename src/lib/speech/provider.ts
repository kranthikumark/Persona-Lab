import "server-only";
import { ApiError } from "@/lib/api";
import { SPEECH_MODEL } from "./contracts";
import { z } from "zod";
const ResponseSchema = z.object({
  transcript: z.string().max(12000),
  audioDurationMs: z.number().finite().nonnegative(),
});
let active = 0;
export async function transcribeMeta(bytes: Uint8Array, signal?: AbortSignal) {
  const key = process.env.META_API_KEY?.trim();
  if (!key)
    throw new ApiError(
      503,
      "Meta speech is not configured. Continue with text practice.",
    );
  if (active >= 2)
    throw new ApiError(
      429,
      "Speech processing is busy. Try again shortly or continue in text.",
    );
  active++;
  const started = Date.now();
  try {
    const body = new FormData();
    body.append(
      "request",
      new Blob(
        [
          JSON.stringify({
            model: SPEECH_MODEL,
            audioEncoding: "WAV",
            mode: "PUSH_TO_TALK",
            languageBias: ["English"],
          }),
        ],
        { type: "application/json" },
      ),
    );
    body.append(
      "audio",
      new Blob([Uint8Array.from(bytes)], { type: "audio/wav" }),
      "recording.wav",
    );
    const response = await fetch("https://api.meta.ai/v1/asr/transcribe", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      body,
      signal: AbortSignal.any([
        AbortSignal.timeout(45000),
        ...(signal ? [signal] : []),
      ]),
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ApiError(
        response.status === 429 ? 429 : 502,
        response.status === 429
          ? "Meta speech is busy. Wait before retrying; your text practice is available."
          : "Meta speech could not transcribe this recording. Your conversation is unchanged; continue in text or try again.",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing response");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) {
          await reader.cancel();
          throw new Error("Oversized speech response");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const data = ResponseSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString("utf8")),
    );
    if (!data.transcript.trim())
      throw new ApiError(
        422,
        "No speech was recognized. Record again or continue in text.",
      );
    return {
      text: data.transcript.trim(),
      audioDurationMs: data.audioDurationMs,
      latencyMs: Date.now() - started,
      model: SPEECH_MODEL as typeof SPEECH_MODEL,
      provider: "meta" as const,
      locale: "en-IN" as const,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      signal?.aborted ? 408 : 502,
      signal?.aborted
        ? "Transcription cancelled. Your conversation is unchanged."
        : "Speech processing failed or timed out. Your conversation is unchanged; text practice is available.",
    );
  } finally {
    active--;
  }
}
