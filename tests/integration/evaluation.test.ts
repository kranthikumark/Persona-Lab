import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
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
  startSession,
  sendTurn,
  sessionView,
  forkBranch,
} from "@/lib/simulation/service";
import { createEvaluation, latestEvaluation } from "@/lib/evaluation/service";
loadEnvFile(".env");
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Evaluation acceptance requires local PostgreSQL.");
const owner = hash(`phase-5-${randomUUID()}`);
let id: string, branch: string;
beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "mock");
  const created = await startSession(owner);
  id = created.sessionId;
  branch = created.branchId;
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await db.$transaction(async (tx) => {
    await tx.branch.updateMany({
      where: { sessionId: id },
      data: { parentBranchId: null, forkSnapshotId: null },
    });
    await tx.simulationSession.delete({ where: { id } });
  });
  expect(await db.evaluation.count({ where: { branchId: branch } })).toBe(0);
});
afterAll(() => db.$disconnect());
const turn = (text: string, revision: number) =>
  sendTurn(branch, owner, { text, revision, key: randomUUID() });
describe("persisted revision-scoped evaluation", () => {
  it("persists one immutable report per revision even for overlapping evaluations", async () => {
    await turn("All claims are guaranteed.", 0);
    const records = await Promise.all([
      createEvaluation(branch, owner, 1),
      createEvaluation(branch, owner, 1),
    ]);
    expect(records[0].id).toBe(records[1].id);
    expect(await db.evaluation.count({ where: { branchId: branch } })).toBe(1);
    expect(await latestEvaluation(branch, owner)).toEqual(records[0]);
    const view = await sessionView(id, owner);
    expect(view.branch.revision).toBe(1);
    expect(
      records[0].report.categories[0].checks[0].evidence[0].messageId,
    ).toBe(view.messages[1].id);
  });
  it("retains old report scope and marks it stale after a later turn", async () => {
    const first = await createEvaluation(branch, owner, 0);
    await turn("What is your budget?", 0);
    const old = await latestEvaluation(branch, owner);
    expect(old?.id).toBe(first.id);
    expect(old?.stale).toBe(true);
    expect(old?.report.scope.revision).toBe(0);
    expect(old?.currentRevision).toBe(1);
    await expect(createEvaluation(branch, owner, 0)).rejects.toMatchObject({
      status: 409,
    });
    const current = await createEvaluation(branch, owner, 1);
    expect(current.id).not.toBe(first.id);
    expect(current.stale).toBe(false);
    expect(await db.evaluation.count({ where: { branchId: branch } })).toBe(2);
    expect(
      (await db.evaluation.findUniqueOrThrow({ where: { id: first.id } }))
        .findings,
    ).toEqual(first.report);
  });
  it("evaluates the full inherited history with shared and post-fork evidence, leaving the parent report untouched", async () => {
    const parent = await turn("All claims are guaranteed.", 0);
    const original = await createEvaluation(branch, owner, 1);
    const child = await forkBranch(
      branch,
      owner,
      parent.snapshots.at(-1)!.id,
      "Corrected alternative",
    );
    await sendTurn(child.branchId, owner, {
      text: "Claims are reviewed. A 30-day waiting period applies.",
      revision: 0,
      key: randomUUID(),
    });
    const alternative = await createEvaluation(child.branchId, owner, 1);
    expect(alternative.report.scope.throughTurn).toBe(2);
    expect(alternative.report.scope.forkTurn).toBe(1);
    expect(alternative.report.categories[0].checks[0].evidence[0].scope).toBe(
      "shared",
    );
    expect(alternative.report.categories[0].checks[1].evidence[0].scope).toBe(
      "after_fork",
    );
    expect(await latestEvaluation(branch, owner)).toEqual(original);
  });
  it("denies other owners and rejects corrupted/foreign evidence on read", async () => {
    await expect(
      createEvaluation(branch, hash("outsider"), 0),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      latestEvaluation(branch, hash("outsider")),
    ).rejects.toMatchObject({ status: 404 });
    await turn("All claims are guaranteed.", 0);
    const saved = await createEvaluation(branch, owner, 1);
    const corrupted = structuredClone(saved.report);
    corrupted.categories[0].checks[0].evidence[0].messageId = "foreign";
    await db.evaluation.update({
      where: { id: saved.id },
      data: { findings: corrupted },
    });
    await expect(latestEvaluation(branch, owner)).rejects.toThrow(
      "does not match",
    );
  });
});

it("rejects an evaluation if a turn commits after history capture but before report persistence", async () => {
  const original = db.$transaction.bind(db);
  let signal!: () => void, release!: () => void;
  const ready = new Promise<void>((resolve) => {
    signal = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  db.$transaction = (async (...args: unknown[]) => {
    if (first) {
      first = false;
      signal();
      await gate;
    }
    return Reflect.apply(original, db, args);
  }) as typeof db.$transaction;
  try {
    const pending = createEvaluation(branch, owner, 0);
    await ready;
    await turn("What is your budget?", 0);
    release();
    await expect(pending).rejects.toMatchObject({ status: 409 });
    expect(await db.evaluation.count({ where: { branchId: branch } })).toBe(0);
  } finally {
    release();
    db.$transaction = original;
  }
});

it("refuses to apply fixed phrase rules to a changed pinned policy", async () => {
  const session = await db.simulationSession.findUniqueOrThrow({
    where: { id },
  });
  const definition = session.scenarioData as Record<string, unknown>;
  await db.simulationSession.update({
    where: { id },
    data: {
      scenarioData: {
        ...definition,
        approvedFacts: [],
      } as Prisma.InputJsonValue,
    },
  });
  await expect(createEvaluation(branch, owner, 0)).rejects.toMatchObject({
    status: 422,
  });
  expect(await db.evaluation.count({ where: { branchId: branch } })).toBe(0);
});

it("upgrades an existing v1 session report without rewriting the saved original", async () => {
  const { evaluate: evaluateLegacy } =
    await import("@/lib/evaluation/legacy-rubric");
  const { historyFor } = await import("@/lib/simulation/service");
  await turn(
    "Have you had a previous claim experience that caused these concerns?",
    0,
  );
  const history = await historyFor(branch);
  const report = evaluateLegacy(history, {
    branchId: branch,
    revision: 1,
    forkTurn: null,
  });
  const original = await db.evaluation.create({
    data: {
      branchId: branch,
      branchRevision: 1,
      rubricVersion: "insurance-rubric-v1",
      findings: report as unknown as Prisma.InputJsonValue,
    },
  });
  expect((await latestEvaluation(branch, owner))?.report.overall).toBeNull();
  const upgraded = await createEvaluation(branch, owner, 1);
  expect(upgraded.id).not.toBe(original.id);
  expect(upgraded.report.rubricVersion).toBe("insurance-rubric-v2");
  expect(upgraded.report.overall).toEqual(expect.any(Number));
  expect(upgraded.report.categories[1].checks[1].status).toBe("demonstrated");
  expect(
    (await db.evaluation.findUniqueOrThrow({ where: { id: original.id } }))
      .findings,
  ).toEqual(report);
  expect((await latestEvaluation(branch, owner))?.id).toBe(upgraded.id);
});
