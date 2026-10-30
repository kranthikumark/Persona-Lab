import "server-only";
import { ApiError } from "@/lib/api";
import { requireBranch } from "@/lib/simulation/service";
import { effectiveSettings } from "@/lib/practice/metadata";
import { reserveBudget } from "@/lib/release/limits";
import {
  MAX_AUDIO_BYTES,
  validConsent,
  type SpeechTranscript,
} from "./contracts";
import { speechCapabilities } from "./capabilities";
import { validateWav } from "./wav";
import { issueSpeechReceipt } from "./receipt";
import { transcribeMeta } from "./provider";
export async function readAudioBody(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length < 0 || length > MAX_AUDIO_BYTES)
    throw new ApiError(
      413,
      "Recording is too large. Use a clip of at most 60 seconds.",
    );
  if (request.headers.get("content-type")?.split(";")[0] !== "audio/wav")
    throw new ApiError(415, "Send PCM WAV audio.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Record audio first.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_AUDIO_BYTES) {
        await reader.cancel();
        throw new ApiError(
          413,
          "Recording is too large. Use a clip of at most 60 seconds.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Uint8Array(Buffer.concat(chunks));
}
export async function transcribeForBranch(
  id: string,
  owner: string | null,
  request: Request,
): Promise<SpeechTranscript> {
  const { branch, session } = await requireBranch(id, owner);
  const revision = Number(request.headers.get("x-persona-revision"));
  if (
    !request.headers.has("x-persona-revision") ||
    !Number.isInteger(revision) ||
    revision < 0 ||
    revision !== branch.revision
  )
    throw new ApiError(
      409,
      "Conversation changed. Return to the current path before recording.",
    );
  if (effectiveSettings(session.settings).practiceLocale !== "en-IN")
    throw new ApiError(
      422,
      "Speech checks currently support English only. Continue in text for this language.",
    );
  if (!speechCapabilities().checkAvailable)
    throw new ApiError(
      503,
      "Speech checks are available only in configured localhost acceptance preview. Text practice remains available.",
    );
  let consent;
  try {
    const header = request.headers.get("x-persona-speech-consent");
    if (!header || header.length > 1024) throw new Error();
    consent = validConsent(JSON.parse(header));
  } catch {
    throw new ApiError(
      403,
      "Explicit, current microphone and Meta processing consent is required.",
    );
  }
  const bytes = await readAudioBody(request);
  try {
    validateWav(bytes);
  } catch (error) {
    throw new ApiError(400, (error as Error).message);
  }
  await reserveBudget([
    { key: `speech:owner:${owner}`, limit: 20, windowSeconds: 3600 },
    { key: "speech:global", limit: 80, windowSeconds: 3600 },
  ]);
  const result = await transcribeMeta(bytes, request.signal);
  const current = await requireBranch(id, owner);
  if (current.branch.revision !== revision)
    throw new ApiError(
      409,
      "Conversation changed during transcription. Discard this result and return to your current path.",
    );
  return {
    ...result,
    receipt: issueSpeechReceipt(
      owner!,
      id,
      revision,
      result.text,
      result.audioDurationMs,
      consent,
    ),
    consentId: consent.id,
    branchId: id,
    revision,
    retention: "ephemeral",
  };
}
