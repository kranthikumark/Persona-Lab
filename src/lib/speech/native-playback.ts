import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ApiError } from "@/lib/api";
import { requireBranch, historyFor } from "@/lib/simulation/service";
import { branchSettings } from "@/lib/practice/server";
import { reserveBudget } from "@/lib/release/limits";
import { acceptancePreview } from "@/lib/localization/release";

export function nativePlaybackEnabled(
  env: Record<string, string | undefined> = process.env,
  platform = process.platform,
) {
  try {
    const origin = new URL(env.APP_ORIGIN ?? "http://127.0.0.1:3100");
    return (
      ["http:", "https:"].includes(origin.protocol) &&
      platform === "darwin" &&
      env.NODE_ENV === "development" &&
      [undefined, "true"].includes(env.PERSONA_SPEECH_ACCEPTANCE) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
    );
  } catch {
    return false;
  }
}
let cached: { until: number; voices: Record<string, string> } | undefined;
export async function nativePlaybackVoices() {
  if (!nativePlaybackEnabled()) return {} as Record<string, string>;
  if (cached && cached.until > Date.now()) return cached.voices;
  const listing = await new Promise<string>((resolve) => {
    execFile(
      "/usr/bin/say",
      ["-v", "?"],
      { timeout: 4000, maxBuffer: 128000 },
      (error, stdout) => resolve(error ? "" : stdout),
    );
  });
  const voices: Record<string, string> = {};
  for (const line of listing.split("\n")) {
    const match = line.match(/^(.+?)\s+(en_[A-Z]+|hi_IN|te_IN)\s+#/);
    if (!match) continue;
    const locale = match[2].replace("_", "-");
    if (locale !== "en-IN" && locale !== "hi-IN" && locale !== "te-IN")
      continue;
    if (locale !== "en-IN" && !acceptancePreview(process.env)) continue;
    if (!voices[locale] || match[1].includes("(Enhanced)"))
      voices[locale] = match[1].trim();
  }
  cached = { until: Date.now() + 20000, voices };
  return voices;
}
let active = 0;
export async function nativeReplyAudio(
  branchId: string,
  owner: string | null,
  messageId: string,
  revision: number,
  signal?: AbortSignal,
) {
  const { branch, session } = await requireBranch(branchId, owner);
  if (!nativePlaybackEnabled())
    throw new ApiError(
      503,
      "Installed Mac playback is available only on localhost in development.",
    );
  if (branch.revision !== revision)
    throw new ApiError(409, "Conversation changed. Reload before replaying.");
  const locale = branchSettings(
    session.settings,
    branch.settings,
  ).practiceLocale;
  const voice = (await nativePlaybackVoices())[locale];
  if (!voice)
    throw new ApiError(
      503,
      "No installed Mac voice is available for this language.",
    );
  const message = (await historyFor(branchId)).messages.find(
    (m) => m.id === messageId && m.role === "assistant",
  );
  if (!message) throw new ApiError(404, "Reply not found on this path.");
  if (!message.content.trim() || message.content.length > 2500)
    throw new ApiError(
      422,
      "This reply is too long for local audio. Read it in the transcript.",
    );
  if (active >= 2)
    throw new ApiError(
      429,
      "Local voice playback is busy. Try Replay shortly.",
    );
  await reserveBudget([
    { key: `native-voice:owner:${owner}`, limit: 60, windowSeconds: 3600 },
    { key: "native-voice:global", limit: 240, windowSeconds: 3600 },
  ]);
  if (active >= 2)
    throw new ApiError(
      429,
      "Local voice playback is busy. Try Replay shortly.",
    );
  active++;
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "persona-voice-"));
    const path = join(directory, "reply.wav");
    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        "/usr/bin/say",
        [
          "-v",
          voice,
          "--file-format=WAVE",
          "--data-format=LEI16@24000",
          "-o",
          path,
          "-f",
          "-",
        ],
        { timeout: 20000, maxBuffer: 4096, signal },
        (error) =>
          error ? reject(new Error("Local synthesis failed")) : resolve(),
      );
      child.stdin?.on("error", () => {});
      child.stdin?.end(message.content); // Never text in shell arguments or logs.
    });
    const info = await stat(path);
    if (info.size < 44 || info.size > 90 * 48000 + 8192)
      throw new ApiError(
        422,
        "This reply exceeds the audio limit. Read it in the transcript.",
      );
    const current = await requireBranch(branchId, owner);
    if (current.branch.revision !== revision)
      throw new ApiError(409, "Conversation changed during audio preparation.");
    return new Uint8Array(await readFile(path));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      signal?.aborted ? 408 : 503,
      "Local audio could not be prepared. Try Replay or continue reading.",
    );
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      active--;
    }
  }
}
