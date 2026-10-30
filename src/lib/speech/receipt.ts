import "server-only";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { MessageSourceSchema } from "@/lib/practice/metadata";
import {
  SPEECH_MODEL,
  SpeechConsentSchema,
  validConsent,
  type SpeechConsent,
} from "./contracts";
const Payload = z
  .object({
    version: z.literal("speech-receipt-v1"),
    id: z.uuid(),
    branchId: z.string().min(1).max(100),
    revision: z.number().int().nonnegative(),
    locale: z.enum(["en-IN", "hi-IN", "te-IN"]),
    model: z.literal(SPEECH_MODEL),
    rawText: z.string().min(1).max(2000),
    audioDurationMs: z.number().finite().min(0).max(65000),
    consent: SpeechConsentSchema,
  })
  .strict();
function signature(encoded: string, owner: string) {
  const key = process.env.META_API_KEY?.trim();
  if (!key)
    throw new ApiError(
      503,
      "Speech verification is unavailable. Use keyboard text or transcribe again.",
    );
  return createHmac("sha256", key)
    .update("persona-speech-receipt-v1\0")
    .update(owner)
    .update("\0")
    .update(encoded)
    .digest();
}
export function issueSpeechReceipt(
  owner: string,
  branchId: string,
  revision: number,
  rawText: string,
  audioDurationMs: number,
  consent: SpeechConsent,
  locale: "en-IN" | "hi-IN" | "te-IN" = "en-IN",
) {
  if (rawText.length > 2000) return undefined;
  const payload = Payload.parse({
    version: "speech-receipt-v1",
    id: randomUUID(),
    branchId,
    revision,
    locale,
    model: SPEECH_MODEL,
    rawText,
    audioDurationMs,
    consent,
  });
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded, owner).toString("base64url")}`;
}
export function verifiedVoiceSource(
  token: string | undefined,
  owner: string,
  branchId: string,
  revision: number,
  text: string,
  locale: "en-IN" | "hi-IN" | "te-IN" = "en-IN",
) {
  try {
    if (!token || token.length > 16000) throw new Error();
    const parts = token.split(".");
    if (
      parts.length !== 2 ||
      !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
      !/^[A-Za-z0-9_-]{43}$/.test(parts[1])
    )
      throw new Error();
    const actual = Buffer.from(parts[1], "base64url"),
      expected = signature(parts[0], owner);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error();
    const payload = Payload.parse(
      JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")),
    );
    validConsent(payload.consent);
    if (
      payload.branchId !== branchId ||
      payload.revision !== revision ||
      payload.locale !== locale
    )
      throw new Error();
    return MessageSourceSchema.parse({
      version: "message-source-v1",
      modality: "voice",
      originalLocale: payload.locale,
      originalText: text,
      provenance: "confirmed_transcript",
      translations: [],
      consentId: payload.consent.id,
      transcript: {
        provider: "meta",
        confirmedByUser: true,
        model: payload.model,
        rawText: payload.rawText,
        audioDurationMs: payload.audioDurationMs,
        receiptId: payload.id,
        consent: payload.consent,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      422,
      "This voice transcript is expired, changed or belongs to another path. Transcribe again or choose Use keyboard text.",
    );
  }
}
