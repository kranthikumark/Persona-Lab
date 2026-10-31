import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { requireBranch } from "@/lib/simulation/service";
import { branchSettings } from "@/lib/practice/server";
import { nativePlaybackVoices } from "@/lib/speech/native-playback";
import { reserveBudget } from "@/lib/release/limits";
export const PREVIEW_SECONDS = 120;
const TEMPLATE_FACE = "bf13113a-355a-4d97-8b90-4edccd1da7b2";
const leases = new Map<
  string,
  { branchId: string; until: number; id: string }
>();
export function simliConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const custom = env.SIMLI_FACE_ID?.trim();
  const face = custom || TEMPLATE_FACE;
  const valid = z.uuid().safeParse(face).success;
  return {
    configured: !!env.SIMLI_API_KEY?.trim() && valid,
    faceId: face,
    customFace: !!custom,
    previewSeconds: PREVIEW_SECONDS,
  };
}
export async function simliToken(faceId: string, signal?: AbortSignal) {
  const key = process.env.SIMLI_API_KEY?.trim();
  if (!key) throw new ApiError(503, "Video avatar is not configured yet.");
  try {
    const response = await fetch("https://api.simli.ai/compose/token", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.any([
        AbortSignal.timeout(12000),
        ...(signal ? [signal] : []),
      ]),
      headers: { "Content-Type": "application/json", "x-simli-api-key": key },
      body: JSON.stringify({
        faceId,
        maxSessionLength: PREVIEW_SECONDS,
        maxIdleTime: 60,
        handleSilence: true,
        audioInputFormat: "pcm16",
      }),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ApiError(
        response.status === 429 ? 429 : 503,
        response.status === 402
          ? "Simli has no available avatar minutes. Voice practice is still available."
          : "Simli could not start this avatar. Check your account access, face and available minutes; voice practice is available.",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32000) {
          await reader.cancel();
          throw new Error();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    return z
      .object({ session_token: z.string().min(8).max(24000) })
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8"))).session_token;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "Video avatar could not connect. Try again or continue with the portrait and voice.",
    );
  }
}
export async function startAvatar(
  branchId: string,
  owner: string | null,
  revision: number,
  leaseId: string,
  signal?: AbortSignal,
) {
  const { branch, session } = await requireBranch(branchId, owner);
  if (branch.revision !== revision)
    throw new ApiError(
      409,
      "Conversation changed. Reload before enabling video.",
    );
  const config = simliConfig();
  if (!config.configured)
    throw new ApiError(503, "Video avatar is not configured yet.");
  const locale = branchSettings(
    session.settings,
    branch.settings,
  ).practiceLocale;
  if (!(await nativePlaybackVoices())[locale])
    throw new ApiError(
      503,
      "A renderable voice source is unavailable for this language. Portrait and device speech remain available.",
    );
  for (const [key, lease] of leases)
    if (lease.until <= Date.now()) leases.delete(key);
  if (leases.has(owner!))
    throw new ApiError(
      429,
      "A video preview is already active. End it before starting another.",
    );
  // Test runs have their own counters; production admissions stay shared in PostgreSQL.
  const run =
    process.env.NODE_ENV !== "production" && process.env.AI_PROVIDER === "mock"
      ? process.env.PERSONA_ACCEPTANCE_RUN
      : undefined;
  const prefix = run && /^[a-zA-Z0-9-]{1,64}$/.test(run) ? `test:${run}:` : "";
  await reserveBudget([
    {
      key: `${prefix}simli:owner:${owner}`,
      limit: 2,
      windowSeconds: 3600,
      exceededMessage:
        "This browser has reached the app's limit of two video starts per hour. Try again after the hourly window resets; voice practice remains available. This is not a Simli credit-balance error.",
    },
    {
      key: `${prefix}simli:global`,
      limit: 8,
      windowSeconds: 86400,
      exceededMessage:
        "The app's shared limit of eight video starts per day has been reached. This includes verification runs. Try again after the daily window resets; voice practice remains available. This is not a Simli credit-balance error.",
    },
  ]);
  if (leases.has(owner!))
    throw new ApiError(429, "A video preview is already active.");
  leases.set(owner!, {
    branchId,
    id: leaseId,
    until: Date.now() + (PREVIEW_SECONDS + 30) * 1000,
  });
  try {
    const iceServers = await simliIce(signal);
    const token = await simliToken(config.faceId, signal);
    const current = await requireBranch(branchId, owner);
    if (
      current.branch.revision !== revision ||
      leases.get(owner!)?.id !== leaseId
    )
      throw new ApiError(
        409,
        "Conversation changed while video was connecting.",
      );
    return {
      session_token: token,
      iceServers,
      transport: "p2p" as const,
      previewSeconds: PREVIEW_SECONDS,
      customFace: config.customFace,
    };
  } catch (error) {
    if (leases.get(owner!)?.id === leaseId) leases.delete(owner!);
    throw error;
  }
}

// TURN credentials are ephemeral and intended for the browser. The account
// API key remains on the server, including when requesting relay access.
export async function simliIce(signal?: AbortSignal) {
  try {
    const response = await fetch("https://api.simli.ai/compose/ice", {
      headers: { "x-simli-api-key": process.env.SIMLI_API_KEY!.trim() },
      redirect: "error",
      signal: AbortSignal.any([
        AbortSignal.timeout(12000),
        ...(signal ? [signal] : []),
      ]),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error();
    }
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16000) {
          await reader.cancel();
          throw new Error();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const url = z
      .string()
      .max(512)
      .regex(
        /^(stun|stuns|turn|turns):[a-z0-9.-]+(?::\d+)?(?:\?transport=(udp|tcp))?$/i,
      );
    return z
      .array(
        z
          .object({
            urls: z.union([url, z.array(url).min(1).max(8)]),
            username: z.string().max(1024).optional(),
            credential: z.string().max(2048).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(8)
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    throw new ApiError(
      503,
      "Video relay could not connect. Retry video or use voice only.",
    );
  }
}
export async function endAvatar(
  branchId: string,
  owner: string | null,
  leaseId: string,
) {
  await requireBranch(branchId, owner);
  if (
    leases.get(owner!)?.branchId === branchId &&
    leases.get(owner!)?.id === leaseId
  )
    leases.delete(owner!);
  return { ended: true };
}
