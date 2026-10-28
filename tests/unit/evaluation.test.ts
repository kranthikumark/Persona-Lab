import { describe, expect, it } from "vitest";
import {
  evaluate,
  validateEvidence,
  type EvaluationHistory,
} from "@/lib/evaluation/rubric";
const scope = { branchId: "branch", revision: 3, forkTurn: null };
export const completeInputs = [
  "I understand your concern. Claims are reviewed; approval is never guaranteed. A 30-day waiting period applies.",
  "What is your budget? What was your past experience?",
  "May I send a summary in writing? Take your time to review before you decide.",
];
function history(texts: string[]): EvaluationHistory {
  return {
    messages: texts.map((content, i) => ({
      id: `m${i + 1}`,
      role: "user",
      content,
      turn: i + 1,
      sequence: i * 2 + 1,
    })),
    events: texts.map((_, i) => ({
      id: `e${i + 1}`,
      turn: i + 1,
      payload: { messageId: `m${i + 1}` },
    })),
  };
}
describe("versioned evidence-grounded rubric", () => {
  it("scores empty and partial conversations without awarding missing skills", () => {
    const empty = evaluate(history([]), { ...scope, revision: 0 });
    expect(empty.overall).toBe(0);
    expect(empty.assessedChecks).toBe(0);
    expect(empty.categories.every((c) => c.score === 0)).toBe(true);
    const partial = evaluate(history(["Hello"]), { ...scope, revision: 1 });
    expect(partial.assessedChecks).toBe(1);
    expect(partial.overall).toBe(8);
    expect(
      partial.categories.find((c) => c.id === "communication")!.score,
    ).toBe(50);
  });
  it("uses the documented five weights and ten supported checks", () => {
    const report = evaluate(history(completeInputs), scope);
    expect(report.categories.map((c) => c.weight)).toEqual([
      30, 20, 20, 15, 15,
    ]);
    expect(report.assessedChecks).toBe(10);
    expect(report.overall).toBe(100);
    expect(report.categories.every((c) => c.score === 100)).toBe(true);
  });
  it("weights a guarantee concern and retains it despite a later correction", () => {
    const report = evaluate(
      history(["All claims are guaranteed.", ...completeInputs]),
      { ...scope, revision: 4 },
    );
    expect(report.categories[0].score).toBe(50);
    expect(report.overall).toBe(85);
    const check = report.categories[0].checks[0];
    expect(check.status).toBe("concern");
    expect(check.evidence[0]).toMatchObject({
      messageId: "m1",
      eventId: "e1",
      turn: 1,
    });
  });
  it("supports a reasoned refusal pending review as an appropriate next step", () => {
    const report = evaluate(
      history(["I cannot recommend a policy without reviewing your needs."]),
      { ...scope, revision: 1 },
    );
    expect(report.categories.find((c) => c.id === "nextStep")!.score).toBe(100);
  });
  it("does not reward pressure, conflicting terms, or a long response", () => {
    const report = evaluate(
      history([
        ...completeInputs,
        "Sign now. Cosmetic procedures are covered. No waiting period.",
        Array(71).fill("word").join(" "),
      ]),
      { ...scope, revision: 5 },
    );
    expect(report.categories[0].checks[1].status).toBe("concern");
    expect(report.categories[3].score).toBe(0);
    expect(report.categories[4].score).toBe(0);
  });
  it("ignores character claims and labels inherited evidence separately", () => {
    const data = history(completeInputs);
    data.messages.push({
      id: "assistant",
      role: "assistant",
      content: "All claims are guaranteed",
      turn: 3,
      sequence: 6,
    });
    const report = evaluate(data, { ...scope, forkTurn: 1 });
    expect(report.overall).toBe(100);
    expect(report.categories[0].checks[0].evidence[0].scope).toBe("shared");
    expect(report.categories[1].checks[0].evidence[0].scope).toBe("after_fork");
  });
  it.each(["message", "event", "turn", "scope", "weight", "score"])(
    "rejects fabricated %s evidence or scoring",
    (field) => {
      const data = history(completeInputs),
        report = evaluate(data, scope);
      if (field === "message")
        report.categories[0].checks[0].evidence[0].messageId =
          "foreign-message";
      if (field === "event")
        report.categories[0].checks[0].evidence[0].eventId = "fabricated-event";
      if (field === "turn")
        report.categories[0].checks[0].evidence[0].turn = 99;
      if (field === "scope") report.scope.branchId = "another-branch";
      if (field === "weight") report.categories[0].weight = 99;
      if (field === "score") report.overall = 12;
      expect(() => validateEvidence(report, data, scope)).toThrow(
        "does not match",
      );
    },
  );
  it("rejects mismatched event links rather than inventing evidence", () => {
    const data = history(completeInputs);
    data.events[0].payload = { messageId: "someone-else" };
    expect(() => evaluate(data, scope)).toThrow("missing its recorded event");
  });
});

it("does not count an explicitly negated checked term as positive evidence", () => {
  const report = evaluate(history(["There is no 30-day waiting period."]), {
    ...scope,
    revision: 1,
  });
  expect(report.categories[0].checks[1].status).toBe("concern");
});

it("recognizes the real session's equivalent wording with exact evidence", () => {
  const data = history([
    "Priya, that's a very valid concern. I understand why you'd be skeptical.",
    "Have you had a previous claim experience that caused these concerns?",
    "Approval still depends on eligibility and policy terms.",
  ]);
  const report = evaluate(data, scope);
  for (const id of [
    "acknowledgement",
    "experience-question",
    "claim-boundaries",
  ]) {
    const check = report.categories
      .flatMap((c) => c.checks)
      .find((c) => c.id === id)!;
    expect(check.status).toBe("demonstrated");
    expect(check.evidence).toHaveLength(1);
    expect(
      data.messages.find((m) => m.id === check.evidence[0].messageId),
    ).toBeDefined();
  }
});

it("does not manufacture a strength or an actual concern when evidence is missing", () => {
  const report = evaluate(history(["Hello"]), { ...scope, revision: 1 });
  const budget = report.categories[1].checks[0];
  expect(budget.status).toBe("insufficient");
  expect(budget.evidence).toEqual([]);
  expect(report.categories[1].score).toBe(0);
  expect(report.overall).toBeGreaterThanOrEqual(0);
  expect(report.overall).toBeLessThanOrEqual(100);
});

it("keeps legacy saved reports verifiable under their original scoring", async () => {
  const { evaluate: oldEvaluate } =
    await import("@/lib/evaluation/legacy-rubric");
  const data = history(["Hello"]);
  const old = oldEvaluate(data, { ...scope, revision: 1 });
  expect(old.overall).toBeNull();
  expect(validateEvidence(old, data, { ...scope, revision: 1 })).toEqual(old);
  expect(evaluate(data, { ...scope, revision: 1 }).overall).toBe(8);
});
