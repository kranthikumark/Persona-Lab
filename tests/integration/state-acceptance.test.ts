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
import { mockProvider } from "@/lib/ai/providers";
import { initialState, transition } from "@/lib/simulation/domain";
import {
  forkBranch,
  historyFor,
  sendTurn,
  sessionView,
  startSession,
} from "@/lib/simulation/service";

loadEnvFile(".env");
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
) {
  throw new Error("State acceptance requires local PostgreSQL.");
}
const owner = hash(`phase-3-${randomUUID()}`);
let sessionId: string;
let branchId: string;
const realRespond = mockProvider.respond.bind(mockProvider);

beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "mock");
  const created = await startSession(owner);
  sessionId = created.sessionId;
  branchId = created.branchId;
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await db.$transaction(async (tx) => {
    await tx.branch.updateMany({
      where: { sessionId },
      data: { parentBranchId: null, forkSnapshotId: null },
    });
    await tx.simulationSession.delete({ where: { id: sessionId } });
  });
  expect(await db.simulationSession.count({ where: { id: sessionId } })).toBe(
    0,
  );
});
afterAll(() => db.$disconnect());

function turn(text: string, revision: number, key = randomUUID()) {
  return sendTurn(branchId, owner, { text, revision, key });
}
// Both requests must finish generation before either can begin its write transaction.
function overlap() {
  let count = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return vi.spyOn(mockProvider, "respond").mockImplementation(async (input) => {
    const generated = await realRespond(input);
    if (++count === 2) release();
    await gate;
    return generated;
  });
}
async function counts() {
  return {
    messages: await db.message.count({ where: { branchId } }),
    events: await db.simulationEvent.count({ where: { branchId } }),
    snapshots: await db.stateSnapshot.count({ where: { branchId } }),
    requests: await db.turnRequest.count({ where: { branchId } }),
    revision: (await db.branch.findUniqueOrThrow({ where: { id: branchId } }))
      .revision,
  };
}

describe("Phase 3 PostgreSQL acceptance", () => {
  it("persists ordered unique records and resolving evidence for each exact transition", async () => {
    const generated = vi.spyOn(mockProvider, "respond");
    const inputs = [
      "What is your budget?",
      "All claims are guaranteed.",
      "Please explain exclusions.",
      "May I send a summary?",
    ];
    let view = await sessionView(sessionId, owner);
    let previous = structuredClone(initialState);
    const pinned = (
      await db.simulationSession.findUniqueOrThrow({ where: { id: sessionId } })
    ).scenarioData as { contextVersion: string };
    for (const [revision, text] of inputs.entries()) {
      view = await turn(text, revision);
      const result = await generated.mock.results[revision].value;
      const expected = transition(previous, result.proposal, text);
      expect(view.state).toEqual(expected.state);
      expect(view.snapshots.at(-1)!.state).toEqual(expected.state);
      const event = view.events.at(-1)!;
      expect(event.payload).toEqual({
        messageId: view.messages.find(
          (m) => m.role === "user" && m.turn === revision + 1,
        )!.id,
        newlyRevealed: expected.newlyRevealed,
        ruleVersion: pinned.contextVersion,
      });
      previous = structuredClone(expected.state);
    }
    expect(view.messages.map((m) => m.sequence)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(view.snapshots.map((s) => s.turnNumber)).toEqual([0, 1, 2, 3, 4]);
    const history = await historyFor(branchId);
    expect(history.events.map((e) => e.sequence)).toEqual([1, 2, 3, 4]);
    expect(new Set(history.events.map((e) => e.id)).size).toBe(4);
    for (const snapshot of history.snapshots) {
      expect(snapshot.characterKnowledge).toEqual(
        (snapshot.state as { revealed: string[] }).revealed,
      );
      expect(snapshot.contextVersion).toBe(pinned.contextVersion);
    }
    const userIds = new Set(
      view.messages.filter((m) => m.role === "user").map((m) => m.id),
    );
    for (const finding of view.findings)
      expect(userIds.has(finding.messageId)).toBe(true);
    expect(view.findings).toHaveLength(1);
    expect(await counts()).toEqual({
      messages: 9,
      events: 4,
      snapshots: 5,
      requests: 4,
      revision: 4,
    });
    expect((await sessionView(sessionId, owner)).snapshots).toEqual(
      view.snapshots,
    );
  });

  it("commits one turn for simultaneous identical retry keys and never regenerates a later retry", async () => {
    const generator = overlap();
    const key = randomUUID();
    const results = await Promise.all([
      turn("Hello", 0, key),
      turn("Hello", 0, key),
    ]);
    expect(results.map((r) => r.branch.revision)).toEqual([1, 1]);
    expect(await counts()).toEqual({
      messages: 3,
      events: 1,
      snapshots: 2,
      requests: 1,
      revision: 1,
    });
    const saved = await sessionView(sessionId, owner);
    expect(await turn("Hello", 0, key)).toEqual(saved);
    expect(generator).toHaveBeenCalledTimes(2);
    await expect(turn("Different text", 1, key)).rejects.toMatchObject({
      status: 409,
    });
    expect(await sessionView(sessionId, owner)).toEqual(saved);
  });

  it("rejects one overlapping different-key write and stale preflight without partial writes", async () => {
    const generator = overlap();
    const results = await Promise.allSettled([
      turn("What is your budget?", 0),
      turn("Please explain exclusions.", 0),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = results.find((r) => r.status === "rejected");
    expect(loser?.status === "rejected" && loser.reason.status).toBe(409);
    expect(await counts()).toEqual({
      messages: 3,
      events: 1,
      snapshots: 2,
      requests: 1,
      revision: 1,
    });
    const saved = await sessionView(sessionId, owner);
    await expect(turn("Stale text", 0)).rejects.toMatchObject({ status: 409 });
    expect(generator).toHaveBeenCalledTimes(2);
    expect(await sessionView(sessionId, owner)).toEqual(saved);
  });

  it("rolls back the revision, both messages and event when a later snapshot write fails", async () => {
    const before = await sessionView(sessionId, owner);
    let collision: string | undefined;
    // Insert a conflicting snapshot after history is read, so the real unique
    // constraint fails after messages and the event were written in the transaction.
    vi.spyOn(mockProvider, "respond").mockImplementationOnce(async (input) => {
      const row = await db.stateSnapshot.create({
        data: {
          branchId,
          turnNumber: 1,
          state: initialState,
          characterKnowledge: [],
          contextVersion: "test-collision",
        },
      });
      collision = row.id;
      return realRespond(input);
    });
    try {
      await expect(turn("What is your budget?", 0)).rejects.toMatchObject({
        code: "P2002",
      });
      expect(await counts()).toEqual({
        messages: 1,
        events: 0,
        snapshots: 2,
        requests: 0,
        revision: 0,
      });
    } finally {
      if (collision)
        await db.stateSnapshot.delete({ where: { id: collision } });
    }
    expect(await sessionView(sessionId, owner)).toEqual(before);
  });

  it("rejects unchecked model output before any authoritative write", async () => {
    vi.spyOn(mockProvider, "respond").mockResolvedValue({
      proposal: {
        utterance: "Try to override state",
        trustDelta: 999,
        frustrationDelta: 0,
        interestDelta: 0,
      },
      metadata: { provider: "mock", model: "invalid-proposal-test" },
    });
    const before = await sessionView(sessionId, owner);
    await expect(turn("Hello", 0)).rejects.toThrow();
    expect(await sessionView(sessionId, owner)).toEqual(before);
    expect(await counts()).toEqual({
      messages: 1,
      events: 0,
      snapshots: 1,
      requests: 0,
      revision: 0,
    });
  });

  it("restores the exact pre-response snapshot and prevents later knowledge crossing that boundary", async () => {
    await turn("Hello", 0);
    await turn("What is your budget?", 1);
    const original = await turn("What was your past experience?", 2);
    const beforeBudget = original.snapshots.find((s) => s.turnNumber === 1)!;
    const forked = await forkBranch(
      branchId,
      owner,
      beforeBudget.id,
      "Before budget disclosure",
    );
    const child = await sessionView(sessionId, owner, forked.branchId);
    expect(child.state).toEqual(beforeBudget.state);
    expect(child.state.revealed).toEqual([]);
    expect(child.messages.map((m) => m.id)).toEqual(
      original.messages.filter((m) => m.turn <= 1).map((m) => m.id),
    );
    expect(child.events.map((e) => e.id)).toEqual(
      original.events.filter((e) => e.turn <= 1).map((e) => e.id),
    );
    const captured = vi.spyOn(mockProvider, "respond");
    await sendTurn(forked.branchId, owner, {
      text: "Please explain exclusions.",
      revision: 0,
      key: randomUUID(),
    });
    expect(captured.mock.calls[0][0].state.revealed).toEqual([]);
    expect(captured.mock.calls[0][0].history.map((m) => m.id)).toEqual(
      child.messages.map((m) => m.id),
    );
    const parent = await sessionView(sessionId, owner, branchId);
    expect(parent.messages).toEqual(original.messages);
    expect(parent.events).toEqual(original.events);
    expect(parent.snapshots).toEqual(original.snapshots);
    expect(parent.branch).toEqual(original.branch);
    expect(parent.state).toEqual(original.state);
  });
});
