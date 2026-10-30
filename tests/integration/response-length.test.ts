import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import {
  forkBranch,
  historyFor,
  sendTurn,
  sessionView,
  startSession,
} from "@/lib/simulation/service";
import { mockProvider } from "@/lib/ai/providers";
import { createEvaluation, latestEvaluation } from "@/lib/evaluation/service";
import { exportData } from "@/lib/reports/data";
import { evaluate as evaluateV2 } from "@/lib/evaluation/v2-rubric";
import { Prisma } from "@prisma/client";
loadEnvFile(".env");
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Local database required.");
let sessionId: string, branchId: string;
const owner = hash(`v502-${randomUUID()}`);
beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("PERSONA_ACCEPTANCE_RUN", randomUUID());
  const created = await startSession(owner);
  sessionId = created.sessionId;
  branchId = created.branchId;
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await db.branch.updateMany({
    where: { sessionId },
    data: { parentBranchId: null, forkSnapshotId: null },
  });
  await db.simulationSession.delete({ where: { id: sessionId } });
});
afterAll(() => db.$disconnect());
const send = (text: string, revision = 0, key = randomUUID()) =>
  sendTurn(branchId, owner, { text, revision, key });
describe("server-side word admission", () => {
  it.each([
    "",
    "... 🙂",
    Array(71).fill("word").join(" "),
    "x".repeat(2001),
    Array(71).fill("నమస్తే").join(" "),
  ])(
    "rejects invalid input without provider admission or authoritative writes: %j",
    async (text) => {
      const respond = vi.spyOn(mockProvider, "respond");
      const before = await sessionView(sessionId, owner);
      const budgetWhere = {
        key: { startsWith: `test:${process.env.PERSONA_ACCEPTANCE_RUN}:` },
      };
      const buckets = await db.rateLimitBucket.findMany({ where: budgetWhere });
      await expect(send(text)).rejects.toMatchObject({ status: 422 });
      expect(respond).not.toHaveBeenCalled();
      expect(await sessionView(sessionId, owner)).toEqual(before);
      expect(await db.turnRequest.count({ where: { branchId } })).toBe(0);
      // Owner budget is absent; no per-owner provider admission occurred.
      const ownerBuckets = await db.rateLimitBucket.findMany({
        where: budgetWhere,
      });
      expect(ownerBuckets).toEqual(buckets);
    },
  );
  it("accepts original Unicode content, records validation atomically and forks it unchanged", async () => {
    const text = "  नमस्ते మీ budget ₹1250 🙂  ";
    const parent = await send(text);
    const stored = await db.message.findFirstOrThrow({
      where: { branchId, role: "user" },
    });
    expect(stored.content).toBe(text);
    expect(stored.metadata).toMatchObject({
      validation: { wordCount: 4, locale: "en-IN", status: "passed" },
    });
    const child = await forkBranch(
      branchId,
      owner,
      parent.snapshots.at(-1)!.id,
      "Alternative",
    );
    const inherited = await sessionView(sessionId, owner, child.branchId);
    expect(inherited.messages[1].length).toEqual(parent.messages[1].length);
    expect(inherited.messages[1].inherited).toBe(true);
    const before = await sessionView(sessionId, owner, child.branchId);
    await expect(
      sendTurn(child.branchId, owner, {
        text: "word ".repeat(71),
        revision: 0,
        key: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await sessionView(sessionId, owner, child.branchId)).toEqual(before);
  });
  it("accepts 70 words and replays a committed key without another generation", async () => {
    const respond = vi.spyOn(mockProvider, "respond");
    const text = Array(70).fill("word").join(" ");
    const key = randomUUID();
    const first = await send(text, 0, key);
    expect(await send(text, 0, key)).toEqual(first);
    expect(respond).toHaveBeenCalledTimes(1);
    await expect(send(` ${text} `, 0, key)).rejects.toMatchObject({
      status: 409,
    });
    await expect(send("different", 1, key)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("replays a historical long turn before word validation, retaining reports and branch history", async () => {
    const key = randomUUID();
    const text = "word ".repeat(71).trim();
    await send("Hello", 0, key);
    await db.message.updateMany({
      where: { branchId, role: "user" },
      data: {
        content: text,
        metadata: Prisma.DbNull,
        sourceMetadata: Prisma.DbNull,
      },
    });
    await db.turnRequest.update({
      where: { branchId_key: { branchId, key } },
      data: { inputHash: hash(text) },
    });
    const history = await historyFor(branchId);
    const v2 = evaluateV2(history, { branchId, revision: 1, forkTurn: null });
    const record = await db.evaluation.create({
      data: {
        branchId,
        branchRevision: 1,
        rubricVersion: v2.rubricVersion,
        findings: v2 as unknown as Prisma.InputJsonValue,
      },
    });
    const respond = vi.spyOn(mockProvider, "respond");
    const before = await sessionView(sessionId, owner);
    expect(await send(text, 0, key)).toEqual(before);
    expect(await send(` ${text} `, 0, key)).toEqual(before);
    expect(respond).not.toHaveBeenCalled();
    expect((await latestEvaluation(branchId, owner))!.report).toEqual(v2);
    expect((await exportData(branchId, owner, 1, record.id)).rubric).toBe(
      "insurance-rubric-v2",
    );
    const v3 = await createEvaluation(branchId, owner, 1);
    expect(v3.report.totalChecks).toBe(9);
    expect(
      (await db.evaluation.findUniqueOrThrow({ where: { id: record.id } }))
        .findings,
    ).toEqual(v2);
    if (!("length" in v3.report)) throw new Error("Missing length report");
    expect(v3.report.length[0].status).toBe("accepted_before_rule");
  });
});
