import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import {
  forkBranch,
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
  throw new Error(
    "Persistence integration tests require a local PostgreSQL database.",
  );
}
const owner = hash(`integration-test-${randomUUID()}`);
let sessionId: string;
let branchId: string;

beforeAll(async () => {
  vi.stubEnv("AI_PROVIDER", "mock");
  const created = await startSession(owner);
  sessionId = created.sessionId;
  branchId = created.branchId;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  if (sessionId) {
    await db.$transaction(async (tx) => {
      await tx.branch.updateMany({
        where: { sessionId },
        data: { parentBranchId: null, forkSnapshotId: null },
      });
      await tx.simulationSession.delete({ where: { id: sessionId } });
    });
  }
  await db.$disconnect();
});

describe("PostgreSQL consistency", () => {
  it("leaves all recorded state unchanged when the real adapter transport fails", async () => {
    vi.stubEnv("AI_PROVIDER", "meta");
    vi.stubEnv("META_API_KEY", "test-only-placeholder");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Simulated network failure")),
    );
    const before = await sessionView(sessionId, owner);
    await expect(
      sendTurn(branchId, owner, {
        text: "Hello",
        key: randomUUID(),
        revision: 0,
      }),
    ).rejects.toThrow("conversation is unchanged");
    const after = await sessionView(sessionId, owner);
    expect(after.messages).toEqual(before.messages);
    expect(after.snapshots).toEqual(before.snapshots);
    expect(after.events).toEqual(before.events);
    expect(after.branch.revision).toBe(0);
    expect(await db.turnRequest.count({ where: { branchId } })).toBe(0);
  });

  it("rolls back messages and revision if an event write fails inside the transaction", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const collision = await db.simulationEvent.create({
      data: {
        branchId,
        sequence: 1,
        turn: 1,
        type: "TEST_COLLISION",
        payload: {},
      },
    });
    try {
      await expect(
        sendTurn(branchId, owner, {
          text: "Hello",
          key: randomUUID(),
          revision: 0,
        }),
      ).rejects.toThrow();
      expect(await db.message.count({ where: { branchId } })).toBe(1);
      expect(await db.stateSnapshot.count({ where: { branchId } })).toBe(1);
      expect(
        (await db.branch.findUniqueOrThrow({ where: { id: branchId } }))
          .revision,
      ).toBe(0);
      expect(await db.turnRequest.count({ where: { branchId } })).toBe(0);
    } finally {
      await db.simulationEvent.delete({ where: { id: collision.id } });
    }
  });

  it("restores a nonzero decision and preserves inherited IDs through nested forks", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    const original = await sendTurn(branchId, owner, {
      text: "What is your budget?",
      key: randomUUID(),
      revision: 0,
    });
    const fork = await forkBranch(
      branchId,
      owner,
      original.snapshots.at(-1)!.id,
      "Nonzero boundary",
    );
    const child = await sessionView(sessionId, owner, fork.branchId);
    expect(child.messages.map((m) => m.id)).toEqual(
      original.messages.map((m) => m.id),
    );
    expect(child.state).toEqual(original.state);
    expect(child.state.revealed).toEqual(["budgetConcern"]);
    const changed = await sendTurn(fork.branchId, owner, {
      text: "All claims are guaranteed",
      key: randomUUID(),
      revision: 0,
    });
    expect(changed.state.violations).toBe(1);
    const nested = await forkBranch(
      fork.branchId,
      owner,
      changed.snapshots.at(-1)!.id,
      "Nested boundary",
    );
    const nestedView = await sessionView(sessionId, owner, nested.branchId);
    expect(nestedView.messages.map((m) => m.id)).toEqual(
      changed.messages.map((m) => m.id),
    );
    expect(nestedView.state).toEqual(changed.state);
    const unchanged = await sessionView(sessionId, owner, branchId);
    expect(unchanged.messages).toEqual(original.messages);
    expect(unchanged.events).toEqual(original.events);
    expect(unchanged.state.violations).toBe(0);
  });
});
