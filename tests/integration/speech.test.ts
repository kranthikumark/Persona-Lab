import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { afterEach, afterAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import { startSession, sendTurn, historyFor } from "@/lib/simulation/service";
import { transcribeForBranch } from "@/lib/speech/service";
import { newConsent } from "@/lib/speech/contracts";
import { encodeWav } from "@/lib/speech/wav";
import { transcribeMeta } from "@/lib/speech/provider";
vi.mock("@/lib/speech/provider", () => ({ transcribeMeta: vi.fn() }));
loadEnvFile(".env");
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Local database required");
let owner: string;
const ids: string[] = [];
beforeEach(() => {
  owner = hash(randomUUID());
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("META_API_KEY", "test-only-never-used");
  vi.stubEnv("PERSONA_LOCALE_ACCEPTANCE", "1");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
  vi.stubEnv("PERSONA_ACCEPTANCE_RUN", randomUUID());
  vi.mocked(transcribeMeta)
    .mockReset()
    .mockResolvedValue({
      text: "What is your budget?",
      locale: "en-IN",
      provider: "meta",
      model: "muse-voice-transcribe-1.0",
      audioDurationMs: 1000,
      latencyMs: 10,
    });
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await db.branch.updateMany({
    where: { sessionId: { in: ids } },
    data: { parentBranchId: null, forkSnapshotId: null },
  });
  await db.simulationSession.deleteMany({
    where: { id: { in: ids.splice(0) } },
  });
});
afterAll(() => db.$disconnect());
function request(
  revision = 0,
  consent: unknown = newConsent(),
  bytes = encodeWav(new Float32Array(24000), 24000),
) {
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: {
      "Content-Type": "audio/wav",
      "x-persona-revision": String(revision),
      "x-persona-speech-consent": JSON.stringify(consent),
    },
    body: Uint8Array.from(bytes),
  });
}
it("transcription is owner-bound, consent-bound, ephemeral and makes no authoritative writes", async () => {
  const created = await startSession(owner);
  ids.push(created.sessionId);
  const before = await historyFor(created.branchId);
  const result = await transcribeForBranch(created.branchId, owner, request());
  expect(result.text).toBe("What is your budget?");
  expect(result.retention).toBe("ephemeral");
  expect(result.revision).toBe(0);
  expect(await historyFor(created.branchId)).toEqual(before);
  expect(
    await db.turnRequest.count({ where: { branchId: created.branchId } }),
  ).toBe(0);
  expect(
    await db.evaluation.count({ where: { branchId: created.branchId } }),
  ).toBe(0);
});
it("rejects foreign ownership, stale revision, invalid consent, unsupported audio and native locale before provider access", async () => {
  const created = await startSession(owner);
  ids.push(created.sessionId);
  await expect(
    transcribeForBranch(created.branchId, "foreign", request()),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    transcribeForBranch(created.branchId, owner, request(1)),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    transcribeForBranch(created.branchId, owner, request(0, {})),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    transcribeForBranch(
      created.branchId,
      owner,
      request(0, newConsent(), new Uint8Array(44)),
    ),
  ).rejects.toMatchObject({ status: 400 });
  const native = await startSession(owner, { practiceLocale: "te-IN" });
  ids.push(native.sessionId);
  await expect(
    transcribeForBranch(native.branchId, owner, request()),
  ).rejects.toMatchObject({ status: 422 });
  expect(transcribeMeta).not.toHaveBeenCalled();
});
it("a conversation revision changing during provider processing discards the result", async () => {
  const created = await startSession(owner);
  ids.push(created.sessionId);
  vi.mocked(transcribeMeta).mockImplementationOnce(async () => {
    await sendTurn(created.branchId, owner, {
      text: "What is your budget?",
      revision: 0,
      key: randomUUID(),
    });
    return {
      text: "Old request",
      locale: "en-IN",
      provider: "meta",
      model: "muse-voice-transcribe-1.0",
      audioDurationMs: 1000,
      latencyMs: 10,
    };
  });
  await expect(
    transcribeForBranch(created.branchId, owner, request()),
  ).rejects.toMatchObject({ status: 409 });
  expect((await historyFor(created.branchId)).messages).toHaveLength(3);
});
