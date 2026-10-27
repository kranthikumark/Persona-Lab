import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import { mockProvider } from "@/lib/ai/providers";
import { startSession, forkBranch, sendTurn } from "@/lib/simulation/service";
import { reserveBudget } from "@/lib/release/limits";
import { purgeExpiredSessions } from "@/lib/release/retention";

loadEnvFile(".env");
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Release tests require local PostgreSQL.");
const owner = hash(`release-${randomUUID()}`);
const prefix = `test:${randomUUID()}:`;
beforeEach(() => vi.stubEnv("AI_PROVIDER", "mock"));
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await db.$transaction(async (tx) => {
    await tx.branch.updateMany({
      where: { session: { ownerHash: owner } },
      data: { parentBranchId: null, forkSnapshotId: null },
    });
    await tx.simulationSession.deleteMany({ where: { ownerHash: owner } });
    await tx.rateLimitBucket.deleteMany({
      where: {
        OR: [{ key: { startsWith: prefix } }, { key: { endsWith: owner } }],
      },
    });
  });
});
afterAll(() => db.$disconnect());

it("exhausted generation admission blocks provider work but allows a committed retry", async () => {
  const { branchId } = await startSession(owner);
  const key = randomUUID();
  const input = { text: "Hello", key, revision: 0 };
  await sendTurn(branchId, owner, input);
  await db.rateLimitBucket.update({
    where: { key: `mock:generation:owner:${owner}` },
    data: { count: 40 },
  });
  const provider = vi.spyOn(mockProvider, "respond");
  expect((await sendTurn(branchId, owner, input)).branch.revision).toBe(1);
  await expect(
    sendTurn(branchId, owner, { ...input, key: randomUUID(), revision: 1 }),
  ).rejects.toMatchObject({ status: 429 });
  expect(provider).not.toHaveBeenCalled();
  expect(await db.message.count({ where: { branchId } })).toBe(3);
});

it("shared admission accepts only the cap under concurrent calls and resets expired windows", async () => {
  const budget = { key: `${prefix}cap`, limit: 3, windowSeconds: 60 };
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => reserveBudget([budget])),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  for (const result of results)
    if (result.status === "rejected")
      expect(result.reason).toMatchObject({ status: 429 });
  expect(
    (await db.rateLimitBucket.findUniqueOrThrow({ where: { key: budget.key } }))
      .count,
  ).toBe(3);
  await db.rateLimitBucket.update({
    where: { key: budget.key },
    data: { expiresAt: new Date(0) },
  });
  await reserveBudget([budget]);
  expect(
    (await db.rateLimitBucket.findUniqueOrThrow({ where: { key: budget.key } }))
      .count,
  ).toBe(1);
});

it("a rejected owner budget rolls back its shared budget reservation", async () => {
  const global = { key: `${prefix}a-global`, limit: 5, windowSeconds: 60 };
  const individual = { key: `${prefix}z-owner`, limit: 1, windowSeconds: 60 };
  await reserveBudget([global, individual]);
  await expect(reserveBudget([global, individual])).rejects.toMatchObject({
    status: 429,
  });
  expect(
    (await db.rateLimitBucket.findUniqueOrThrow({ where: { key: global.key } }))
      .count,
  ).toBe(1);
});

it("concurrent session starts cannot exceed the daily owner quota", async () => {
  const first = await startSession(owner);
  const source = await db.simulationSession.findUniqueOrThrow({
    where: { id: first.sessionId },
  });
  await db.simulationSession.createMany({
    data: Array.from({ length: 18 }, () => ({
      ownerHash: owner,
      scenarioId: source.scenarioId,
      scenarioData: source.scenarioData!,
      expiresAt: source.expiresAt,
    })),
  });
  const attempts = await Promise.allSettled([
    startSession(owner),
    startSession(owner),
  ]);
  expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const rejected = attempts.find((r) => r.status === "rejected");
  expect(rejected?.status === "rejected" && rejected.reason.status).toBe(429);
  expect(
    await db.simulationSession.count({ where: { ownerHash: owner } }),
  ).toBe(20);
});

it("concurrent forks cannot exceed the ten-branch session quota", async () => {
  const { sessionId, branchId } = await startSession(owner);
  const snapshot = await db.stateSnapshot.findFirstOrThrow({
    where: { branchId },
  });
  for (let i = 0; i < 8; i++)
    await forkBranch(branchId, owner, snapshot.id, `Path ${i}`);
  const results = await Promise.allSettled([
    forkBranch(branchId, owner, snapshot.id, "One"),
    forkBranch(branchId, owner, snapshot.id, "Two"),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await db.branch.count({ where: { sessionId } })).toBe(10);
});

it("expiry during generation prevents a late turn commit", async () => {
  const { sessionId, branchId } = await startSession(owner);
  const respond = mockProvider.respond.bind(mockProvider);
  vi.spyOn(mockProvider, "respond").mockImplementation(async (input) => {
    await db.simulationSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(0) },
    });
    return respond(input);
  });
  await expect(
    sendTurn(branchId, owner, {
      text: "Hello",
      key: randomUUID(),
      revision: 0,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await db.message.count({ where: { branchId } })).toBe(1);
  expect(await db.turnRequest.count({ where: { branchId } })).toBe(0);
});

it("retention removes an expired forked aggregate and evaluations while preserving active practice", async () => {
  const expired = await startSession(owner);
  const active = await startSession(owner);
  const snapshot = await db.stateSnapshot.findFirstOrThrow({
    where: { branchId: expired.branchId },
  });
  await forkBranch(expired.branchId, owner, snapshot.id, "Expired child");
  await db.evaluation.create({
    data: {
      branchId: expired.branchId,
      branchRevision: 0,
      rubricVersion: "test",
      findings: {},
    },
  });
  await db.simulationSession.update({
    where: { id: expired.sessionId },
    data: { expiresAt: new Date(0) },
  });
  const result = await purgeExpiredSessions(1);
  expect(result.deletedSessions).toBe(1);
  expect(
    await db.simulationSession.findUnique({ where: { id: expired.sessionId } }),
  ).toBeNull();
  expect(
    await db.branch.count({ where: { sessionId: expired.sessionId } }),
  ).toBe(0);
  expect(
    await db.evaluation.count({ where: { branchId: expired.branchId } }),
  ).toBe(0);
  expect(
    await db.message.count({ where: { branchId: expired.branchId } }),
  ).toBe(0);
  expect(
    await db.simulationSession.findUnique({ where: { id: active.sessionId } }),
  ).not.toBeNull();
});
