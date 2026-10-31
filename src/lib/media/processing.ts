import "server-only";
import { execFile } from "node:child_process";
import { access, readFile, mkdir, rm, stat } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/api";
import { validateWav } from "@/lib/speech/wav";
import { MAX_AUDIO_BYTES } from "@/lib/speech/contracts";
import { mediaRoot } from "./storage";
import { MAX_SOURCE_SECONDS } from "./contracts";
const defaultBin =
  process.platform === "darwin" ? "/opt/homebrew/bin" : "/usr/bin";
function binary(tool: "ffmpeg" | "ffprobe") {
  return (
    process.env[
      tool === "ffmpeg" ? "PERSONA_FFMPEG_PATH" : "PERSONA_FFPROBE_PATH"
    ] || path.join(defaultBin, tool)
  );
}
export async function mediaToolsAvailable() {
  try {
    await Promise.all([
      access(binary("ffmpeg"), constants.X_OK),
      access(binary("ffprobe"), constants.X_OK),
    ]);
    return true;
  } catch {
    return false;
  }
}
let active = 0;
function run(tool: "ffmpeg" | "ffprobe", args: string[], signal?: AbortSignal) {
  if (active >= 2)
    throw new ApiError(429, "Media processing is busy. Retry shortly.");
  active++;
  return new Promise<string>((resolve, reject) =>
    execFile(
      /* turbopackIgnore: true */ binary(tool),
      args,
      { timeout: 20000, maxBuffer: 65536, signal },
      (error, stdout) =>
        error
          ? reject(
              new ApiError(
                422,
                "This clip could not be read. Use an unencrypted WAV, MP3, M4A, MP4 or WebM file with an audio track.",
              ),
            )
          : resolve(stdout),
    ),
  ).finally(() => {
    active--;
  });
}
const inputOptions = [
  "-protocol_whitelist",
  "file,pipe",
  "-format_whitelist",
  "wav,mp3,mov,matroska,webm",
  "-probesize",
  "5000000",
  "-analyzeduration",
  "5000000",
];
export async function inspectSource(
  file: string,
  format: string,
  mime: string,
  signal?: AbortSignal,
) {
  const result = JSON.parse(
    await run(
      "ffprobe",
      [
        "-v",
        "error",
        "-max_alloc",
        "67108864",
        ...inputOptions,
        "-show_entries",
        "format=duration:stream=codec_type,codec_name,duration:stream_disposition=attached_pic",
        "-of",
        "json",
        file,
      ],
      signal,
    ),
  );
  if (
    !Array.isArray(result.streams) ||
    result.streams.length > 8 ||
    !result.streams.some(
      (s: { codec_type: string }) => s.codec_type === "audio",
    )
  )
    throw new ApiError(
      422,
      "Choose a clip with an audio track; silent video cannot be transcribed.",
    );
  const duration = Number(result.format?.duration);
  if (
    !Number.isFinite(duration) ||
    duration < 0.25 ||
    duration > MAX_SOURCE_SECONDS
  )
    throw new ApiError(
      422,
      "Use a clip between 0.25 and 60 seconds with readable duration metadata.",
    );
  const video = result.streams.some(
    (s: { codec_type: string; disposition?: { attached_pic?: number } }) =>
      s.codec_type === "video" && s.disposition?.attached_pic !== 1,
  );
  const contentType =
    format === "mp4"
      ? video
        ? "video/mp4"
        : "audio/mp4"
      : format === "webm"
        ? video
          ? "video/webm"
          : "audio/webm"
        : format === "mp3"
          ? "audio/mpeg"
          : "audio/wav";
  const normalized = mime.toLowerCase().split(";")[0];
  const aliases: Record<string, string> = {
    "audio/x-wav": "audio/wav",
    "audio/wave": "audio/wav",
    "audio/mp3": "audio/mpeg",
    "audio/x-m4a": "audio/mp4",
  };
  if ((aliases[normalized] || normalized) !== contentType)
    throw new ApiError(
      422,
      "File contents do not match the selected audio/video type.",
    );
  return {
    durationMs: Math.round(duration * 1000),
    kind: video ? "video" : "audio",
    contentType,
  };
}
export async function withSourceAudio<T>(
  input: string,
  action: (wav: Uint8Array) => Promise<T>,
  signal?: AbortSignal,
) {
  const work = path.join(await mediaRoot(), `work-${randomUUID()}`);
  await mkdir(work, { mode: 0o700 });
  const output = path.join(work, "speech.wav");
  try {
    await run(
      "ffmpeg",
      [
        "-nostdin",
        "-hide_banner",
        "-v",
        "error",
        "-max_alloc",
        "67108864",
        ...inputOptions,
        "-threads",
        "1",
        "-i",
        input,
        "-t",
        "60.1",
        "-map",
        "0:a:0",
        "-vn",
        "-sn",
        "-dn",
        "-ac",
        "1",
        "-ar",
        "24000",
        "-c:a",
        "pcm_s16le",
        "-map_metadata",
        "-1",
        "-f",
        "wav",
        output,
      ],
      signal,
    );
    if ((await stat(output)).size > MAX_AUDIO_BYTES)
      throw new ApiError(
        422,
        "Decoded audio exceeds 60 seconds. Shorten the clip.",
      );
    const bytes = new Uint8Array(await readFile(output));
    try {
      validateWav(bytes);
    } catch {
      throw new ApiError(
        422,
        "Decoded audio must be between 0.25 and 60 seconds.",
      );
    }
    return await action(bytes);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
