import { describe, expect, it } from "vitest";
import {
  resolveRuntime,
  CURRENT_RUNTIME,
  progressFor,
} from "@/lib/simulation/progression";
import historical from "../fixtures/v5-01/legacy-history.json";
import baseline from "../fixtures/v5-01/baseline.json";
import { publicScenario } from "@/lib/scenarios/public";
import { initialState } from "@/lib/simulation/domain";
import * as current from "@/lib/evaluation/rubric";
import * as v2 from "@/lib/evaluation/v2-rubric";
import * as legacy from "@/lib/evaluation/legacy-rubric";
const proposal = {
  utterance: "Thank you.",
  trustDelta: 0,
  frustrationDelta: 0,
  interestDelta: 0,
};
describe("frozen pre-migration V5 baseline", () => {
  it("preserves the original public facts, opening, constraints and runtime identity", () => {
    expect(publicScenario).toEqual(baseline.scenario);
    expect(initialState).toEqual(baseline.initialState);
    expect(
      [legacy, v2].map((r) => ({
        rubricVersion: r.RUBRIC_VERSION,
        engineVersion: r.ENGINE_VERSION,
      })),
    ).toEqual(baseline.rubrics);
  });
  it("keeps pre-rule long turns, shared branch evidence and saved v1/v2 reports interpretable", () => {
    expect(historical.history.messages[0].content.split(" ")).toHaveLength(71);
    for (const [index, engine] of [legacy, v2].entries()) {
      const report = historical.reports[index];
      expect(current.ReportSchema.safeParse(report).success).toBe(true);
      expect(engine.evaluate(historical.history, historical.scope)).toEqual(
        report,
      );
      expect(
        current.validateEvidence(
          report as current.EvaluationReport,
          historical.history,
          historical.scope,
        ),
      ).toEqual(report);
    }
  });
  // v1 remains frozen; new runtime v2 corrects these cases without rewriting it.
  it("V5-03: reviewing documents during discovery must not imply agreement on a next step", () => {
    expect(
      resolveRuntime(CURRENT_RUNTIME).transition(
        initialState,
        proposal,
        "We can review the policy documents together. What concerns you?",
        progressFor(
          [],
          "We can review the policy documents together. What concerns you?",
          1,
        ),
      ).state.phase,
    ).toBe("discovery");
  });
  it("V5-03: a farewell must not regress an agreed next step", () => {
    expect(
      resolveRuntime(CURRENT_RUNTIME).transition(
        { ...initialState, phase: "next_step" },
        proposal,
        "Thank you. Reading the exclusions before deciding is wise. Take care.",
        progressFor(
          [],
          "Thank you. Reading the exclusions before deciding is wise. Take care.",
          1,
        ),
      ).state.phase,
    ).toBe("next_step");
  });
});
