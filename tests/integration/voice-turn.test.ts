import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { afterEach, afterAll, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import {
  startSession,
  sendTurn,
  historyFor,
  forkBranch,
} from "@/lib/simulation/service";
import { issueSpeechReceipt } from "@/lib/speech/receipt";
import { newConsent } from "@/lib/speech/contracts";
import { mockProvider } from "@/lib/ai/providers";
import { createEvaluation } from "@/lib/evaluation/service";
loadEnvFile(".env");
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Local database required");
const ids: string[] = [];
let owner: string;
beforeEach(() => {
  owner = hash(randomUUID());
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("META_API_KEY", "synthetic-voice-signing-test");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
  vi.stubEnv("PERSONA_ACCEPTANCE_RUN", randomUUID());
});
afterEach(async () => {
  vi.restoreAllMocks();
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
it("commits reviewed voice once, retains raw transcript and supports retry after receipt expiry/key rotation", async () => {
  const session = await startSession(owner);
  ids.push(session.sessionId);
  const original = await historyFor(session.branchId);
  const receipt = issueSpeechReceipt(
    owner,
    session.branchId,
    0,
    "What is your budget",
    900,
    newConsent(),
  )!;
  const input = {
    text: "What is your monthly budget?",
    key: randomUUID(),
    revision: 0,
    inputModality: "voice" as const,
    speechReceipt: receipt,
  };
  const result = await sendTurn(session.branchId, owner, input);
  expect(result.branch.revision).toBe(1);
  expect(result.messages[1].source).toMatchObject({
    modality: "voice",
    originalText: input.text,
    transcript: { rawText: "What is your budget", confirmedByUser: true },
  });
  expect(result.messages[1].length!.validation!.inputModality).toBe("voice");
  vi.stubEnv("META_API_KEY", "rotated-after-commit");
  expect(await sendTurn(session.branchId, owner, input)).toEqual(result);
  expect((await historyFor(session.branchId)).messages).toHaveLength(3);
  const child = await forkBranch(
    session.branchId,
    owner,
    original.snapshots[0].id,
    "Voice alternative",
  );
  expect((await historyFor(child.branchId)).messages).toHaveLength(1);
  expect((await historyFor(session.branchId)).messages).toHaveLength(3);
  const report = await createEvaluation(session.branchId, owner, 1);
  expect(report.report.overall).toBeGreaterThanOrEqual(0);
});
it("foreign-path, missing and overlong voice input never reaches character generation or writes", async () => {
  const session = await startSession(owner);
  ids.push(session.sessionId);
  const before = await historyFor(session.branchId);
  const respond = vi.spyOn(mockProvider, "respond");
  const forged = issueSpeechReceipt(
    "foreign",
    session.branchId,
    0,
    "Hello",
    1000,
    newConsent(),
  )!;
  for (const input of [
    { text: "Hello", speechReceipt: forged },
    { text: "Hello" },
    {
      text: Array(71).fill("word").join(" "),
      speechReceipt: issueSpeechReceipt(
        owner,
        session.branchId,
        0,
        "Hello",
        1000,
        newConsent(),
      )!,
    },
  ])
    await expect(
      sendTurn(session.branchId, owner, {
        ...input,
        key: randomUUID(),
        revision: 0,
        inputModality: "voice",
      }),
    ).rejects.toMatchObject({ status: 422 });
  expect(respond).not.toHaveBeenCalled();
  expect(await historyFor(session.branchId)).toEqual(before);
});
it("a typed retry key cannot be repurposed for a voice response", async () => {
  const session = await startSession(owner);
  ids.push(session.sessionId);
  const key = randomUUID();
  await sendTurn(session.branchId, owner, { text: "Hello", key, revision: 0 });
  const receipt = issueSpeechReceipt(
    owner,
    session.branchId,
    0,
    "Hello",
    1000,
    newConsent(),
  )!;
  await expect(
    sendTurn(session.branchId, owner, {
      text: "Hello",
      key,
      revision: 0,
      inputModality: "voice",
      speechReceipt: receipt,
    }),
  ).rejects.toMatchObject({ status: 409 });
});
