import { z } from "zod";
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
export const MAX_SOURCE_SECONDS = 60;
export const SourceLocale = z.enum(["en-IN", "hi-IN", "te-IN"]);
export const UploadMeta = z
  .object({
    draftRevision: z.number().int().positive(),
    name: z.string().trim().min(1).max(120),
    bytes: z.number().int().positive().max(MAX_SOURCE_BYTES),
    locale: SourceLocale,
    retentionDays: z.union([z.literal(1), z.literal(7)]),
    rights: z.literal(true),
    retention: z.literal(true),
  })
  .strict();
export const ProcessInput = z
  .object({
    revision: z.number().int().positive(),
    draftRevision: z.number().int().positive(),
    processingConsent: z.literal(true),
  })
  .strict();
export const ReviewInput = z
  .object({
    revision: z.number().int().positive(),
    draftRevision: z.number().int().positive(),
    text: z.string().trim().min(1).max(12000),
    translation: z.string().trim().max(12000).optional(),
    confirmed: z.literal(true),
  })
  .strict();
export const DeleteInput = z
  .object({
    revision: z.number().int().positive(),
    draftRevision: z.number().int().positive(),
  })
  .strict();
export type SourceDTO = {
  id: string;
  revision: number;
  status: string;
  name: string;
  kind: string;
  contentType: string;
  byteSize: number;
  locale: string;
  durationMs: number | null;
  expiresAt: string;
  failureReason: string | null;
  transcript: null | {
    version: number;
    text: string;
    translation: string | null;
    locale: string;
    provider: string;
    model: string | null;
    reviewedAt: string | null;
  };
};
export function sourceFormat(bytes: Uint8Array) {
  const text = (offset: number, n: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + n));
  if (text(0, 4) === "RIFF" && text(8, 4) === "WAVE") return "wav";
  if (text(4, 4) === "ftyp") return "mp4";
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  )
    return "webm";
  if (text(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
    return "mp3";
  throw new Error("Upload a WAV, MP3, M4A, MP4 or WebM clip.");
}
export function sourceName(name: string) {
  const clean = name
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 120);
  if (!clean) throw new Error("Provide a file name.");
  return clean;
}
