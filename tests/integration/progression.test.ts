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
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import {
  forkBranch,
  historyFor,
  sendTurn,
  sessionView,
  startSession,
} from "@/lib/simulation/service";
import { CURRENT_RUNTIME, progressFor } from "@/lib/simulation/progression";
import { mockProvider } from "@/lib/ai/providers";
import { createEvaluation } from "@/lib/evaluation/service";
loadEnvFile(".env");
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Local database required.");
const owner = hash(`v503-${randomUUID()}`);
let id: string, branch: string;
beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("PERSONA_ACCEPTANCE_RUN", randomUUID());
  const created = await startSession(owner);
  id = created.sessionId;
  branch = created.branchId;
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await db.branch.updateMany({
    where: { sessionId: id },
    data: { parentBranchId: null, forkSnapshotId: null },
  });
  await db.simulationSession.delete({ where: { id } });
});
afterAll(() => db.$disconnect());
const send = (text: string, revision = 0, branchId = branch) =>
  sendTurn(branchId, owner, { text, revision, key: randomUUID() });
async function pin(overrides: Record<string, unknown>) {
  const session = await db.simulationSession.findUniqueOrThrow({
    where: { id },
  });
  await db.simulationSession.update({
    where: { id },
    data: {
      scenarioData: {
        ...(session.scenarioData as object),
        ...overrides,
      } as Prisma.InputJsonValue,
    },
  });
}
describe("versioned branch progression persistence", () => {
  it("pins new rules/evaluation and records explicit discovery, clarification and next-step milestones", async () => {
    const session = await db.simulationSession.findUniqueOrThrow({
      where: { id },
    });
    expect(session.scenarioData).toMatchObject({
      contextVersion: CURRENT_RUNTIME,
      evaluationVersion: "insurance-rubric-v3",
    });
    const review = await send(
      "We can review the policy documents together. What concerns you?",
    );
    expect(review.state.phase).toBe("discovery");
    const clarified = await send(
      "The monthly premium is ₹1,250. A 30-day initial waiting period applies.",
      1,
    );
    expect(clarified.state.phase).toBe("clarification");
    const next = await send(
      "May I send a policy summary for you to review before deciding?",
      2,
    );
    expect(next.state.phase).toBe("next_step");
    const farewell = await send(
      "Thank you. Reviewing exclusions before deciding is wise. Take care.",
      3,
    );
    expect(farewell.state.phase).toBe("next_step");
    expect(farewell.messages.at(-1)!.content).not.toContain("Yes, share");
    expect(await sessionView(id, owner)).toEqual(farewell);
    const history = await historyFor(branch);
    expect(
      history.snapshots.every((s) => s.contextVersion === CURRENT_RUNTIME),
    ).toBe(true);
    expect(
      (history.events[1].payload as { progress: unknown }).progress,
    ).toEqual(
      progressFor(
        history.messages.filter(
          (m) => m.turn < 2 || (m.turn === 2 && m.role === "user"),
        ),
      ),
    );
  });
  it("uses the frozen legacy reducer when resuming old pins and keeps recorded traces unchanged", async () => {
    await pin({
      contextVersion: "insurance-v1-rules-v1",
      rubricVersion: "insurance-rubric-v2",
      evaluationVersion: "insurance-rubric-v3",
    });
    await db.stateSnapshot.updateMany({
      where: { branchId: branch },
      data: { contextVersion: "insurance-v1-rules-v1" },
    });
    const view = await send("We can review documents together.");
    expect(view.state.phase).toBe("next_step");
    const before = await historyFor(branch);
    const child = await forkBranch(
      branch,
      owner,
      view.snapshots.at(-1)!.id,
      "Legacy child",
    );
    const fork = await sessionView(id, owner, child.branchId);
    expect(fork.state).toEqual(view.state);
    expect(
      (await historyFor(child.branchId)).snapshots.at(-1)!.contextVersion,
    ).toBe("insurance-v1-rules-v1");
    expect(await historyFor(branch)).toEqual(before);
  });
  it("keeps answered topics and private reveals isolated from parent futures and sibling branches", async () => {
    const initial = await sessionView(id, owner);
    const parent = await send("The monthly premium is ₹1,250.");
    const child = await forkBranch(
      branch,
      owner,
      parent.snapshots.at(-1)!.id,
      "Child",
    );
    const sibling = await forkBranch(
      branch,
      owner,
      initial.snapshots[0].id,
      "Sibling",
    );
    await send("A 30-day waiting period applies. What is your budget?", 1);
    const childView = await send(
      "The coverage limit is ₹5,00,000 per policy year.",
      0,
      child.branchId,
    );
    expect(childView.state.revealed).toEqual([]);
    const memory = progressFor((await historyFor(child.branchId)).messages);
    expect(memory.topics.find((t) => t.topic === "price")!.status).toBe(
      "answered",
    );
    expect(memory.topics.find((t) => t.topic === "waiting")!.status).toBe(
      "unanswered",
    );
    expect(
      progressFor((await historyFor(sibling.branchId)).messages).topics.every(
        (t) => t.status === "unanswered",
      ),
    ).toBe(true);
    const root = await sessionView(id, owner);
    expect(root.state.revealed).toContain("budgetConcern");
    const historical = (await historyFor(branch)).snapshots[1];
    expect(historical.characterKnowledge).toEqual([]);
  });
  it.each(["unknown", "mismatch", "facts"])(
    "rejects %s rule pins before provider admission or writes",
    async (kind) => {
      if (kind === "unknown")
        await pin({ contextVersion: "unsupported-rules" });
      else
        await db.stateSnapshot.updateMany({
          where: { branchId: branch },
          data: { contextVersion: "insurance-v1-rules-v1" },
        });
      const before = await historyFor(branch),
        respond = vi.spyOn(mockProvider, "respond");
      await expect(send("Hello")).rejects.toMatchObject({ status: 422 });
      expect(respond).not.toHaveBeenCalled();
      expect(await historyFor(branch)).toEqual(before);
      expect(await db.turnRequest.count({ where: { branchId: branch } })).toBe(
        0,
      );
    },
  );
  it("dispatches the pinned evaluation version and rejects unsupported evaluators", async () => {
    await pin({ evaluationVersion: "insurance-rubric-v2" });
    await send("Hello");
    const old = await createEvaluation(branch, owner, 1);
    expect(old.report.rubricVersion).toBe("insurance-rubric-v2");
    expect(old.report.overall).toBe(8);
    await pin({ evaluationVersion: "unsupported-evaluator" });
    await expect(createEvaluation(branch, owner, 1)).rejects.toMatchObject({
      status: 422,
    });
    expect(
      (await db.evaluation.findUniqueOrThrow({ where: { id: old.id } }))
        .findings,
    ).toEqual(old.report);
  });
});
