import type { SessionView } from "@/lib/client";

type RecordedPath = Pick<SessionView, "messages" | "snapshots" | "events">;
export function sharedMessageCount(left: RecordedPath, right: RecordedPath) {
  let count = 0;
  while (
    count < Math.min(left.messages.length, right.messages.length) &&
    left.messages[count].id === right.messages[count].id
  )
    count++;
  return count;
}
export function turnRecord(path: RecordedPath, turn: number) {
  const user = path.messages.find((m) => m.turn === turn && m.role === "user");
  if (!user) return null;
  const before = path.snapshots.find((s) => s.turnNumber === turn - 1);
  const after = path.snapshots.find((s) => s.turnNumber === turn);
  const event = path.events.find((e) => e.turn === turn);
  return {
    user,
    before,
    after,
    event,
    // Never substitute final state when an intermediate snapshot is unavailable.
    delta:
      before && after
        ? {
            trust: after.state.trust - before.state.trust,
            frustration: after.state.frustration - before.state.frustration,
            interest: after.state.interest - before.state.interest,
            violations: after.state.violations - before.state.violations,
          }
        : null,
  };
}
export function comparePaths(left: RecordedPath, right: RecordedPath) {
  const prefix = sharedMessageCount(left, right);
  const sharedTurn = prefix ? left.messages[prefix - 1].turn : 0;
  const turns = [
    ...new Set(
      [...left.messages.slice(prefix), ...right.messages.slice(prefix)]
        .filter((m) => m.role === "user")
        .map((m) => m.turn),
    ),
  ].sort((a, b) => a - b);
  return {
    prefix,
    sharedTurn,
    rows: turns.map((turn) => ({
      turn,
      paths: [turnRecord(left, turn), turnRecord(right, turn)] as const,
    })),
    unequalLength:
      left.messages.filter((m) => m.role === "user").length !==
      right.messages.filter((m) => m.role === "user").length,
  };
}
