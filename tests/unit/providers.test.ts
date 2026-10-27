import { afterEach, describe, expect, it, vi } from "vitest";
import { initialState } from "@/lib/simulation/domain";
import { insuranceScenario } from "@/lib/scenarios/insurance";
import { metaProvider, mockProvider, providerMode } from "@/lib/ai/providers";
const input = {
  text: "All claims are guaranteed",
  state: initialState,
  history: [],
  scenario: insuranceScenario,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("provider boundaries", () => {
  it("clearly identifies mock generation and challenges guarantees", async () => {
    const result = await mockProvider.respond(input);
    expect(result.metadata.provider).toBe("mock");
    expect(result.proposal.trustDelta).toBeLessThan(0);
  });
  it("never falls back to mock when live credentials are missing", () => {
    vi.stubEnv("AI_PROVIDER", "meta");
    vi.stubEnv("META_API_KEY", "");
    expect(() => providerMode()).toThrow("META_API_KEY");
  });
  it("handles invalid model output without returning an unchecked proposal", async () => {
    vi.stubEnv("META_API_KEY", "test-not-a-secret");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: { content: '{"utterance":"ok","trustDelta":9999}' },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(metaProvider.respond(input)).rejects.toThrow(
      "conversation is unchanged",
    );
  });
  it("does not send unrevealed personal knowledge to the model", async () => {
    vi.stubEnv("META_API_KEY", "test-not-a-secret");
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  utterance: "Tell me more.",
                  trustDelta: 0,
                  frustrationDelta: 0,
                  interestDelta: 0,
                }),
              },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    await metaProvider.respond(input);
    const body = fetcher.mock.calls[0][1].body as string;
    expect(body).not.toContain("1,500");
    expect(body).not.toContain("friend had a claim rejected");
    expect(JSON.parse(body).response_format.type).toBe("json_schema");
  });
  it("returns a recoverable error on HTTP failures", async () => {
    vi.stubEnv("META_API_KEY", "test-not-a-secret");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private upstream body", { status: 429 }),
        ),
    );
    await expect(metaProvider.respond(input)).rejects.toThrow("HTTP 429");
  });
});

describe("mock knowledge parity with server reveal rules", () => {
  it("does not disclose personal history for a near-match the server did not reveal", async () => {
    const result = await mockProvider.respond({
      ...input,
      text: "What concerns you most?",
    });
    expect(result.proposal.utterance).not.toContain("A friend");
  });
  it("uses only explicitly permitted personal facts", async () => {
    const result = await mockProvider.respond({
      ...input,
      text: "What was your past experience?",
      state: { ...initialState, revealed: ["previousExperience"] },
    });
    expect(result.proposal.utterance).toContain("A friend");
    expect(result.proposal.utterance).not.toContain("1,500");
  });
});
