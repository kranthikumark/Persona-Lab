import { expect, it } from "vitest";
import { evaluate } from "@/lib/evaluation/rubric";
import { reportDocument } from "@/lib/reports/data";
it("exports only evaluated evidence excerpts and no access identifiers or unrelated transcript", () => {
  const content =
    "Claims are reviewed; approval is never guaranteed. " +
    "Detail ".repeat(80);
  const history = {
    messages: [
      { id: "private-message-id", role: "user", content, turn: 1, sequence: 1 },
    ],
    events: [
      {
        id: "private-event-id",
        turn: 1,
        payload: { messageId: "private-message-id" },
      },
    ],
  };
  const report = evaluate(history, {
    branchId: "private-branch-id",
    revision: 1,
    forkTurn: null,
  });
  const data = reportDocument(
    report,
    "Original approach",
    "2026-10-28T00:00:00.000Z",
    [
      ...history.messages,
      { id: "unrelated", content: "UNRELATED PRIVATE TRANSCRIPT" },
    ],
  );
  const serialized = JSON.stringify(data);
  for (const secret of [
    "private-message-id",
    "private-event-id",
    "private-branch-id",
    "UNRELATED PRIVATE TRANSCRIPT",
  ])
    expect(serialized).not.toContain(secret);
  expect(data.score).toEqual(expect.any(Number));
  expect(
    data.categories[0].checks[0].evidence[0].excerpt.length,
  ).toBeLessThanOrEqual(260);
  expect(data.categories[0].checks[0].evidence[0].excerpt).toMatch(/…$/);
  expect(data.categories[0].checks[0].evidence[0].turn).toBe(1);
});
