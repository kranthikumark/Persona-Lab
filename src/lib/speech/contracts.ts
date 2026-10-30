import { z } from "zod";
export const SPEECH_MODEL = "muse-voice-transcribe-1.0";
export const MAX_AUDIO_SECONDS = 60;
export const SAMPLE_RATE = 24000;
export const MAX_AUDIO_BYTES = MAX_AUDIO_SECONDS * SAMPLE_RATE * 2 + 4096;
export const CONSENT_MS = 15 * 60 * 1000;
export const SpeechConsentSchema = z
  .object({
    version: z.literal("speech-consent-v1"),
    id: z.uuid(),
    purpose: z.literal("speech_transcription"),
    provider: z.literal("meta"),
    capture: z.literal(true),
    processing: z.literal(true),
    retention: z.literal("ephemeral"),
    cameraAnalysis: z.literal(false),
    grantedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export type SpeechConsent = z.infer<typeof SpeechConsentSchema>;
export function newConsent(): SpeechConsent {
  const now = Date.now();
  return {
    version: "speech-consent-v1",
    id: crypto.randomUUID(),
    purpose: "speech_transcription",
    provider: "meta",
    capture: true,
    processing: true,
    retention: "ephemeral",
    cameraAnalysis: false,
    grantedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + CONSENT_MS).toISOString(),
  };
}
export function validConsent(input: unknown, now = Date.now()) {
  const consent = SpeechConsentSchema.parse(input);
  const start = Date.parse(consent.grantedAt),
    end = Date.parse(consent.expiresAt);
  if (
    start > now + 5000 ||
    end <= now ||
    end <= start ||
    end - start > CONSENT_MS ||
    now - start > CONSENT_MS
  )
    throw new Error("Speech consent expired. Agree again before recording.");
  return consent;
}
export type SpeechTranscript = {
  receipt?: string;
  text: string;
  locale: "en-IN" | "hi-IN" | "te-IN";
  provider: "meta";
  model: typeof SPEECH_MODEL;
  audioDurationMs: number;
  latencyMs: number;
  consentId: string;
  branchId: string;
  revision: number;
  retention: "ephemeral";
};
