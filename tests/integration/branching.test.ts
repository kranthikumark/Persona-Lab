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
)
  throw new Error("Branch acceptance requires local PostgreSQL.");
const owner = hash(`phase-4-${randomUUID()}`);
const sessions: string[] = [];
let sessionId: string;
let root: string;
beforeEach(async () => {
  vi.stubEnv("AI_PROVIDER", "mock");
  const ids = await startSession(owner);
  sessionId = ids.sessionId;
  root = ids.branchId;
  sessions.push(sessionId);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const id of sessions.splice(0)) {
    await db.$transaction(async (tx) => {
      await tx.branch.updateMany({
        where: { sessionId: id },
        data: { parentBranchId: null, forkSnapshotId: null },
      });
      await tx.simulationSession.delete({ where: { id } });
    });
    expect(await db.simulationSession.count({ where: { id } })).toBe(0);
  }
});
afterAll(() => db.$disconnect());
const turn = (branch: string, text: string, revision: number) =>
  sendTurn(branch, owner, { text, revision, key: randomUUID() });
async function recorded(branch: string) {
  const view = await sessionView(sessionId, owner, branch);
  return {
    messages: view.messages,
    events: view.events,
    snapshots: view.snapshots,
    state: view.state,
    branch: view.branch,
  };
}

describe("Phase 4 persisted branch acceptance", () => {
  it("copies only the saved boundary and isolates parent and sibling futures", async () => {
    const boundaryView = await turn(root, "What is your budget?", 0);
    const boundary = boundaryView.snapshots.at(-1)!;
    const raw = await db.stateSnapshot.findUniqueOrThrow({
      where: { id: boundary.id },
    });
    await turn(root, "What was your past experience?", 1);
    const a = await forkBranch(root, owner, boundary.id, "Explain limits");
    const b = await forkBranch(
      root,
      owner,
      boundary.id,
      "Ask about experience",
    );
    for (const child of [a, b]) {
      const local = await db.branch.findUniqueOrThrow({
        where: { id: child.branchId },
        include: {
          messages: true,
          events: true,
          requests: true,
          snapshots: true,
        },
      });
      expect(local.messages).toEqual([]);
      expect(local.events).toEqual([]);
      expect(local.requests).toEqual([]);
      expect(local.snapshots).toHaveLength(1);
      expect(local.snapshots[0].state).toEqual(raw.state);
      expect(local.snapshots[0].characterKnowledge).toEqual(
        raw.characterKnowledge,
      );
      expect(local.snapshots[0].contextVersion).toBe(raw.contextVersion);
      expect(local.forkSnapshotId).toBe(boundary.id);
      const view = await sessionView(sessionId, owner, child.branchId);
      expect(view.messages.map((m) => m.id)).toEqual(
        boundaryView.messages.map((m) => m.id),
      );
      expect(view.events.map((e) => e.id)).toEqual(
        boundaryView.events.map((e) => e.id),
      );
      expect(view.state).toEqual(boundary.state);
    }
    // Continue the parent after forking, then record each sibling's independent continuation.
    await turn(root, "All claims are guaranteed.", 2);
    const parentBefore = await recorded(root);
    const untouched = await recorded(b.branchId);
    const capture = vi.spyOn(mockProvider, "respond");
    const aView = await turn(a.branchId, "Please explain exclusions.", 0);
    expect(capture.mock.calls[0][0].state.revealed).toEqual(["budgetConcern"]);
    expect(capture.mock.calls[0][0].history.map((m) => m.id)).toEqual(
      boundaryView.messages.map((m) => m.id),
    );
    const pinned = (
      await db.simulationSession.findUniqueOrThrow({ where: { id: sessionId } })
    ).scenarioData;
    expect(capture.mock.calls[0][0].scenario).toEqual(pinned);
    expect(await recorded(b.branchId)).toEqual(untouched);
    const aBefore = await recorded(a.branchId);
    const bView = await turn(b.branchId, "What was your past experience?", 0);
    expect(bView.state.revealed).toEqual([
      "budgetConcern",
      "previousExperience",
    ]);
    expect(aView.state.revealed).toEqual(["budgetConcern"]);
    expect(await recorded(a.branchId)).toEqual(aBefore);
    expect(await recorded(root)).toEqual(parentBefore);
    expect(
      await db.stateSnapshot.findUniqueOrThrow({ where: { id: boundary.id } }),
    ).toEqual(raw);
  });

  it("rewinds a nested branch to an inherited ancestor snapshot with stable prefix IDs", async () => {
    const first = await turn(root, "Hello", 0);
    const second = await turn(root, "What is your budget?", 1);
    const child = await forkBranch(
      root,
      owner,
      second.snapshots.at(-1)!.id,
      "Later fork",
    );
    await turn(child.branchId, "What was your past experience?", 0);
    const parentBefore = await recorded(child.branchId);
    const nested = await forkBranch(
      child.branchId,
      owner,
      first.snapshots.at(-1)!.id,
      "Earlier inherited boundary",
    );
    const restored = await sessionView(sessionId, owner, nested.branchId);
    expect(restored.messages.map((m) => m.id)).toEqual(
      first.messages.map((m) => m.id),
    );
    expect(restored.events.map((e) => e.id)).toEqual(
      first.events.map((e) => e.id),
    );
    expect(restored.state).toEqual(first.state);
    const next = await turn(nested.branchId, "Please explain exclusions.", 0);
    expect(next.messages.map((m) => m.sequence)).toEqual([0, 1, 2, 3, 4]);
    expect(next.snapshots.map((s) => s.turnNumber)).toEqual([0, 1, 2]);
    expect(next.state.revealed).toEqual([]);
    expect(await recorded(child.branchId)).toEqual(parentBefore);
    const history = await historyFor(nested.branchId);
    expect(history.events.map((e) => e.sequence)).toEqual([1, 2]);
  });

  it("rejects foreign sessions, sibling-only snapshots, and unauthorized forks without creating branches", async () => {
    const foreign = await startSession(owner);
    sessions.push(foreign.sessionId);
    const foreignView = await sessionView(foreign.sessionId, owner);
    const initial = await sessionView(sessionId, owner);
    const sibling = await forkBranch(
      root,
      owner,
      initial.snapshots[0].id,
      "Sibling",
    );
    const siblingView = await turn(sibling.branchId, "Hello", 0);
    const count = await db.branch.count({ where: { sessionId } });
    for (const snapshot of [
      foreignView.snapshots[0],
      siblingView.snapshots.at(-1)!,
    ]) {
      await expect(
        forkBranch(root, owner, snapshot.id, "Invalid"),
      ).rejects.toMatchObject({ status: 404 });
    }
    await expect(
      forkBranch(
        root,
        hash("outsider"),
        initial.snapshots[0].id,
        "Unauthorized",
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      sessionView(sessionId, owner, foreign.branchId),
    ).rejects.toMatchObject({ status: 404 });
    expect(await db.branch.count({ where: { sessionId } })).toBe(count);
  });
});
