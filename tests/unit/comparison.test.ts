import { describe, expect, it } from "vitest";
import type { SessionView } from "@/lib/client";
import { comparePaths } from "@/lib/simulation/comparison";
import { initialState } from "@/lib/simulation/domain";

type Path = Pick<SessionView, "messages" | "events" | "snapshots">;
const opening = {
  id: "opening",
  role: "assistant",
  content: "Hello",
  turn: 0,
  sequence: 0,
  inherited: true,
};
const snapshot = (n: number, trust: number, violations = 0) => ({
  id: `snapshot-${n}-${trust}`,
  turnNumber: n,
  state: { ...initialState, trust, violations },
});
function path(id: string, trust: number): Path {
  return {
    messages: [
      opening,
      {
        id,
        role: "user",
        content: "Identical wording",
        turn: 1,
        sequence: 1,
        inherited: false,
      },
    ],
    snapshots: [snapshot(0, 35), snapshot(1, trust)],
    events: [
      {
        id: `event-${id}`,
        type: "TURN_COMMITTED",
        turn: 1,
        payload: { messageId: id },
      },
    ],
  };
}
describe("recorded comparison", () => {
  it("finds shared history by record identity rather than matching dialogue text", () => {
    const left = path("left", 23),
      right = path("right", 41);
    const result = comparePaths(left, right);
    expect(result.prefix).toBe(1);
    expect(result.sharedTurn).toBe(0);
    expect(result.rows[0].paths.map((r) => r?.delta?.trust)).toEqual([-12, 6]);
    expect(result.rows[0].paths.map((r) => r?.event?.payload)).toEqual([
      { messageId: "left" },
      { messageId: "right" },
    ]);
  });
  it("labels unequal horizons and leaves absent turns empty rather than fabricating deltas", () => {
    const left = path("left", 23),
      right: Path = {
        messages: [opening],
        snapshots: [snapshot(0, 35)],
        events: [],
      };
    const before = structuredClone([left, right]);
    const result = comparePaths(left, right);
    expect(result.unequalLength).toBe(true);
    expect(result.rows[0].paths[1]).toBeNull();
    expect([left, right]).toEqual(before);
  });
  it("does not replace a missing intermediate snapshot with final indicators", () => {
    const left = path("left", 23);
    left.snapshots = [snapshot(1, 23)];
    expect(
      comparePaths(left, path("right", 41)).rows[0].paths[0]?.delta,
    ).toBeNull();
  });
  it("has no divergent turns when comparing the same recorded path", () => {
    const left = path("left", 23);
    const result = comparePaths(left, left);
    expect(result.prefix).toBe(2);
    expect(result.rows).toEqual([]);
    expect(result.unequalLength).toBe(false);
  });
});
