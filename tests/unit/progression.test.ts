import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CURRENT_RUNTIME,
  progressFor,
  resolveRuntime,
} from "@/lib/simulation/progression";
import { initialState, type TranscriptMessage } from "@/lib/simulation/domain";
import { insuranceScenario } from "@/lib/scenarios/insurance";
import { metaProvider, mockProvider } from "@/lib/ai/providers";
const proposal = {
  utterance: "Tell me more.",
  trustDelta: 5,
  frustrationDelta: -3,
  interestDelta: 2,
};
const message = (
  content: string,
  turn = 1,
  role = "user",
): TranscriptMessage => ({
  id: `m-${turn}-${role}`,
  content,
  role,
  turn,
  sequence: turn * 2 - (role === "user" ? 1 : 0),
});
const topic = (text: string, name: string) =>
  progressFor([message(text)]).topics.find((t) => t.topic === name)!;
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("branch-local answered topic memory", () => {
  it("tracks canonical assertions, questions, conflicts and explicit corrections", () => {
    expect(topic("The monthly premium is ₹1,250.", "price").status).toBe(
      "answered",
    );
    expect(topic("Is the premium ₹1,250?", "price").status).toBe("unanswered");
    expect(topic("The premium is ₹900.", "price").status).toBe("contradicted");
    expect(topic("The coverage limit is 5 lakh.", "limit").status).toBe(
      "answered",
    );
    expect(topic("All claims are not guaranteed.", "claims").status).toBe(
      "answered",
    );
    expect(
      topic("There is no waiting period for covered accidents.", "waiting")
        .status,
    ).not.toBe("contradicted");
    const memory = progressFor([
      message("The premium is ₹900."),
      message("Correction: the monthly premium is ₹1,250.", 2),
    ]);
    expect(memory.topics.find((t) => t.topic === "price")).toMatchObject({
      status: "answered",
      evidenceTurn: 2,
    });
    expect(
      progressFor([
        message("The premium is ₹1,250.", 1, "assistant"),
      ]).topics.every((t) => t.status === "unanswered"),
    ).toBe(true);
  });
  it("does not lose an answered topic beyond the recent 24-message prompt window", () => {
    const history = [
      message("The monthly premium is ₹1,250."),
      ...Array.from({ length: 30 }, (_, i) => message("Thank you.", i + 2)),
    ];
    expect(
      progressFor(history).topics.find((t) => t.topic === "price"),
    ).toMatchObject({ status: "answered", evidenceTurn: 1 });
  });
  it("the deterministic provider moves past answered premium and waiting topics", async () => {
    const history = [
      message(
        "The monthly premium is ₹1,250. A 30-day waiting period applies.",
      ),
      message("Is the premium fixed?", 1, "assistant"),
    ];
    const progress = progressFor(history);
    const result = await mockProvider.respond({
      text: "Thank you.",
      state: initialState,
      history,
      scenario: insuranceScenario,
      progress,
    });
    expect(result.proposal.utterance).not.toMatch(
      /premium|initial waiting period/,
    );
    expect(result.proposal.utterance).toMatch(/coverage limit/);
    const conflict = progressFor(history, "The premium is ₹900.", 2);
    const challenge = await mockProvider.respond({
      text: "The premium is ₹900.",
      state: initialState,
      history,
      scenario: insuranceScenario,
      progress: conflict,
    });
    expect(challenge.proposal.utterance).toMatch(/conflicts.*premium/);
  });
  it("sends grounded memory to Meta without unrevealed private facts", async () => {
    vi.stubEnv("META_API_KEY", "synthetic-test-key");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(proposal) } }],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const progress = progressFor([message("The monthly premium is ₹1,250.")]);
    await metaProvider.respond({
      text: "Thank you.",
      state: initialState,
      history: [],
      scenario: insuranceScenario,
      progress,
    });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    const context = JSON.parse(body.messages[0].content);
    expect(context.conversationProgress).toEqual(progress);
    expect(context.progressionInstruction).toContain("Do not ask again");
    expect(JSON.stringify(body)).not.toContain("1,500");
    expect(JSON.stringify(body)).not.toContain("friend had a claim rejected");
    expect(context.revealedPersonalKnowledge).toEqual({});
  });
});
describe("pinned runtime progression", () => {
  it("preserves legacy reducer outputs and refuses unknown versions", () => {
    expect(
      resolveRuntime("insurance-v1-rules-v1").transition(
        initialState,
        proposal,
        "We can review documents.",
      ).state.phase,
    ).toBe("next_step");
    expect(() => resolveRuntime("insurance-v1-rules-future")).toThrow(
      "Unsupported",
    );
  });
  it("requires actual term clarification before an explicit next-step offer", () => {
    const runtime = resolveRuntime(CURRENT_RUNTIME);
    expect(
      runtime.transition(
        initialState,
        proposal,
        "May I send a summary?",
        progressFor([], "May I send a summary?", 1),
      ).state.phase,
    ).toBe("discovery");
    const fact =
      "The monthly premium is ₹1,250. A 30-day waiting period applies.";
    const history = [message(fact)];
    const clarified = runtime.transition(
      initialState,
      proposal,
      fact,
      progressFor(history),
    ).state;
    expect(clarified.phase).toBe("clarification");
    const offer =
      "May I send a policy summary for you to review before deciding?";
    const next = runtime.transition(
      clarified,
      proposal,
      offer,
      progressFor(history, offer, 2),
    ).state;
    expect(next.phase).toBe("next_step");
    const farewell =
      "Thank you. Reviewing exclusions before deciding is wise. Take care.";
    expect(
      runtime.transition(
        next,
        proposal,
        farewell,
        progressFor(history, farewell, 3),
      ).state.phase,
    ).toBe("next_step");
    const reopened = runtime.transition(
      next,
      proposal,
      "The premium is ₹900.",
      progressFor(history, "The premium is ₹900.", 3),
    );
    expect(reopened.state.phase).toBe("clarification");
    const conflicted = progressFor(
      history,
      "The premium is ₹900. May I send a policy summary?",
      2,
    );
    expect(
      runtime.transition(
        clarified,
        proposal,
        "The premium is ₹900. May I send a policy summary?",
        conflicted,
      ).state.phase,
    ).toBe("clarification");
  });
});
