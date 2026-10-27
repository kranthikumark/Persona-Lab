import { z } from "zod";

export const StateSchema = z
  .object({
    trust: z.number().int().min(0).max(100),
    frustration: z.number().int().min(0).max(100),
    interest: z.number().int().min(0).max(100),
    violations: z.number().int().nonnegative(),
    phase: z.enum(["discovery", "clarification", "next_step"]),
    revealed: z.array(z.enum(["budgetConcern", "previousExperience"])),
  })
  .strict();
export type SimulationState = z.infer<typeof StateSchema>;
export const initialState: SimulationState = {
  trust: 35,
  frustration: 40,
  interest: 30,
  violations: 0,
  phase: "discovery",
  revealed: [],
};
export const ProposalSchema = z
  .object({
    utterance: z.string().trim().min(1).max(2000),
    trustDelta: z.number().int().min(-12).max(12),
    frustrationDelta: z.number().int().min(-12).max(12),
    interestDelta: z.number().int().min(-12).max(12),
  })
  .strict();
export type Proposal = z.infer<typeof ProposalSchema>;
export type TranscriptMessage = {
  id: string;
  role: string;
  content: string;
  turn: number;
  sequence: number;
};

// Narrow, transparent heuristic, not an exhaustive language understanding check.
export function unsupportedGuarantee(text: string) {
  const sentences = text.toLowerCase().split(/[.!?;\n]+/);
  return sentences.some((sentence) => {
    if (
      /\b(no|not|never|cannot|can't|don't|do not)\b.{0,35}\b(guarantee|guaranteed|guarantees)\b/.test(
        sentence,
      )
    )
      return false;
    return (
      /\b(all|every|any)\b.{0,35}\bclaims?\b.{0,30}\b(guaranteed|approved|paid|covered)\b/.test(
        sentence,
      ) ||
      /\bguarantee\b.{0,35}\b(claim|approval|payout)\b/.test(sentence) ||
      /\b100\s*%.{0,25}\b(approval|guarantee)/.test(sentence)
    );
  });
}
export function revealForInput(
  text: string,
  revealed: SimulationState["revealed"],
) {
  const result = new Set(revealed);
  if (/\b(budget|afford|spend|monthly cost)\b/i.test(text))
    result.add("budgetConcern");
  if (
    /\b(previous|past|experience|why.{0,12}(concern|worr)|what.{0,12}(concern|worr))\b/i.test(
      text,
    )
  )
    result.add("previousExperience");
  return [...result];
}
export function transition(
  stateInput: SimulationState,
  proposalInput: Proposal,
  text: string,
) {
  const state = StateSchema.parse(stateInput);
  const proposal = ProposalSchema.parse(proposalInput);
  const violation = unsupportedGuarantee(text);
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const revealed = revealForInput(text, state.revealed);
  const next = StateSchema.parse({
    trust: clamp(state.trust + (violation ? -12 : proposal.trustDelta)),
    frustration: clamp(
      state.frustration + (violation ? 10 : proposal.frustrationDelta),
    ),
    interest: clamp(state.interest + (violation ? -8 : proposal.interestDelta)),
    violations: state.violations + Number(violation),
    revealed,
    phase:
      /\b(send|review|follow.up|next step|summary)\b/i.test(text) && !violation
        ? "next_step"
        : /\b(exclusions?|excluded|waiting|claims?|cover|covered|coverage)\b/i.test(
              text,
            )
          ? "clarification"
          : state.phase,
  });
  return {
    state: next,
    violation,
    newlyRevealed: revealed.filter((key) => !state.revealed.includes(key)),
  };
}
export function findings(messages: TranscriptMessage[]) {
  return messages
    .filter(
      (message) =>
        message.role === "user" && unsupportedGuarantee(message.content),
    )
    .map((message) => ({
      messageId: message.id,
      turn: message.turn,
      title: "Unsupported claim guarantee",
      detail:
        "The fictional policy requires claim review. Explain eligibility and exclusions instead of promising approval.",
      source: "Deterministic phrase check",
    }));
}
