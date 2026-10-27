import { describe, expect, it } from "vitest";
import {
  findings,
  initialState,
  ProposalSchema,
  revealForInput,
  transition,
  unsupportedGuarantee,
} from "@/lib/simulation/domain";
const proposal = {
  utterance: "What about exclusions?",
  trustDelta: 8,
  frustrationDelta: -6,
  interestDelta: 4,
};
describe("authoritative simulation rules", () => {
  it("rejects unbounded deltas and unknown model fields", () => {
    expect(() =>
      ProposalSchema.parse({ ...proposal, trustDelta: 1000 }),
    ).toThrow();
    expect(() =>
      ProposalSchema.parse({ ...proposal, privateKnowledge: "leak" }),
    ).toThrow();
  });
  it("clamps state bounds without mutating the original snapshot", () => {
    const original = { ...initialState, trust: 98, frustration: 2 };
    const result = transition(
      original,
      proposal,
      "Let us review the exclusions.",
    );
    expect(result.state.trust).toBe(100);
    expect(result.state.frustration).toBe(0);
    expect(original.trust).toBe(98);
    expect(original.frustration).toBe(2);
  });
  it("overrides a model's favorable delta for unsupported guarantees", () => {
    const result = transition(
      initialState,
      proposal,
      "All claims are guaranteed.",
    );
    expect(result.violation).toBe(true);
    expect(result.state.trust).toBe(23);
    expect(result.state.violations).toBe(1);
  });
  it("distinguishes a basic negated guarantee from a promise", () => {
    expect(unsupportedGuarantee("I cannot guarantee claim approval.")).toBe(
      false,
    );
    expect(unsupportedGuarantee("I guarantee your claim approval.")).toBe(true);
    expect(unsupportedGuarantee("All claims are guaranteed.")).toBe(true);
  });
  it("reveals personal facts only when an explicit input rule permits them", () => {
    expect(revealForInput("Hello there", [])).toEqual([]);
    expect(revealForInput("What is your budget?", [])).toEqual([
      "budgetConcern",
    ]);
    expect(
      revealForInput("What was your past experience?", ["budgetConcern"]),
    ).toEqual(["budgetConcern", "previousExperience"]);
  });
  it("grounds findings in actual message IDs and ignores character dialogue", () => {
    const records = [
      {
        id: "real-user",
        role: "user",
        content: "All claims are guaranteed",
        turn: 1,
        sequence: 1,
      },
      {
        id: "real-character",
        role: "assistant",
        content: "All claims are guaranteed?",
        turn: 1,
        sequence: 2,
      },
    ];
    expect(findings(records).map((finding) => finding.messageId)).toEqual([
      "real-user",
    ]);
  });
});
