import { canonicalForRules } from "@/lib/localization/rules";
import { z } from "zod";
import {
  initialState,
  StateSchema,
  ProposalSchema,
  transition as legacyTransition,
  revealForInput,
  unsupportedGuarantee,
  type SimulationState,
  type Proposal,
  type TranscriptMessage,
} from "./domain";
export const CURRENT_RUNTIME = "insurance-v1-rules-v2";
export const TOPICS = [
  "price",
  "limit",
  "waiting",
  "exclusions",
  "claims",
] as const;
export type Topic = (typeof TOPICS)[number];
const rules: Record<
  Topic,
  { answer: RegExp; conflict: RegExp; mention: RegExp }
> = {
  price: {
    answer:
      /(?:₹|rs\.?\s*)?1,?250\s*(?:\/\s*month|per month|a month|monthly)|(?:monthly premium|premium)[^.!?\n]{0,30}(?:₹|rs\.?\s*)?1,?250\b/i,
    conflict: /\bpremium\b[^\d.!?\n]{0,30}(?!1,?250\b)\d[\d,]*\b/i,
    mention: /premium|price|monthly cost/i,
  },
  limit: {
    answer: /(?:₹|rs\.?\s*)?5,?00,?000\b|\b5\s*lakh\b/i,
    conflict:
      /\bunlimited\s+(?:cover|coverage)|\b(?:coverage|cover) limit\b[^\d.!?\n]{0,20}(?!5(?:,?00,?000\b|\s*lakh\b))\d[\d,]*\b/i,
    mention: /coverage limit|hospitali[sz]|annual limit/i,
  },
  waiting: {
    answer:
      /\b30[- ]day\b[^.!?\n]{0,30}\bwaiting|\bwaiting\b[^.!?\n]{0,35}\b30[- ]day\b/i,
    conflict: /\bno (?:initial )?waiting period|\b(?:zero|0)[- ]day waiting/i,
    mention: /waiting|30[- ]day/i,
  },
  exclusions: {
    answer:
      /\bcosmetic(?: procedures)?\b[^.!?\n]{0,35}\b(?:excluded|not covered)|\bpre[- ]existing\b[^.!?\n]{0,45}\b24[- ]month\b|\b24[- ]month\b[^.!?\n]{0,45}\bpre[- ]existing/i,
    conflict:
      /\bcosmetic(?: procedures)?\s+(?:are\s+)?(?:covered|included)|\bpre[- ]existing\b[^.!?\n]{0,30}\b(?:immediately covered|no waiting)/i,
    mention: /exclu|cosmetic|pre[- ]existing/i,
  },
  claims: {
    answer:
      /\bclaims?\b[^.!?\n]{0,35}\b(?:reviewed|assessed)|\b(?:approval|claims?)\b[^.!?\n]{0,35}\b(?:not|never) guaranteed|\b(?:cannot|can't) guarantee\b[^.!?\n]{0,20}\b(?:approval|claims?)/i,
    conflict:
      /\b(?:all|every) claims?\b[^.!?\n]{0,30}\b(?:guaranteed|approved|paid)|\bi guarantee\b[^.!?\n]{0,25}\b(?:approval|claims?)/i,
    mention: /claim|approval|guarantee/i,
  },
};
export const ProgressSchema = z
  .object({
    version: z.literal("insurance-topics-v1"),
    topics: z
      .array(
        z
          .object({
            topic: z.enum(TOPICS),
            status: z.enum(["unanswered", "answered", "contradicted"]),
            evidenceTurn: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .length(TOPICS.length),
    lastAsked: z.array(z.enum(TOPICS)),
    nextStepOffered: z.boolean(),
  })
  .strict();
export type Progress = z.infer<typeof ProgressSchema>;
export function offersNextStep(text: string) {
  return /\b(?:may i|could we|can we|would you like|shall (?:i|we))\b[^.!?\n]{0,65}\b(?:send|share|review|schedule|arrange)\b[^.!?\n]{0,65}\b(?:summary|terms|policy|follow.up|call)\b/i.test(
    text,
  );
}
export function progressFor(
  history: TranscriptMessage[],
  text?: string,
  turn = 0,
): Progress {
  const topics = TOPICS.map((topic) => ({
    topic,
    status: "unanswered" as "unanswered" | "answered" | "contradicted",
    evidenceTurn: 0,
  }));
  let lastAsked: Topic[] = [],
    nextStepOffered = false;
  const messages =
    text === undefined
      ? history
      : [
          ...history,
          {
            id: "current-input",
            role: "user",
            content: text,
            turn,
            sequence: turn * 2 - 1,
          },
        ];
  for (const message of messages) {
    if (message.role === "assistant") {
      if (message.content.includes("?"))
        lastAsked = TOPICS.filter((topic) =>
          rules[topic].mention.test(message.content),
        );
      continue;
    }
    if (message.role !== "user") continue;
    for (const sentence of message.content.match(/[^.!?\n]+[.!?]?/g) ?? []) {
      // Questions are requests for information, not an assertion that a fact is settled.
      if (sentence.endsWith("?")) continue;
      for (const item of topics) {
        const rule = rules[item.topic];
        const conflict =
          item.topic === "claims"
            ? unsupportedGuarantee(sentence)
            : rule.conflict.test(sentence) &&
              !(
                item.topic === "waiting" &&
                /\bfor (?:covered )?accidents?\b/i.test(sentence)
              );
        if (conflict) {
          item.status = "contradicted";
          item.evidenceTurn = message.turn;
        } else if (rule.answer.test(sentence)) {
          item.status = "answered";
          item.evidenceTurn = message.turn;
        }
      }
    }
    if (offersNextStep(message.content)) nextStepOffered = true;
  }
  return ProgressSchema.parse({
    version: "insurance-topics-v1",
    topics,
    lastAsked,
    nextStepOffered,
  });
}
export function readyForNextStep(
  state: SimulationState,
  progress: Progress,
  text: string,
) {
  return (
    state.phase === "clarification" &&
    offersNextStep(text) &&
    progress.topics.filter((topic) => topic.status === "answered").length >=
      2 &&
    !progress.topics.some((topic) => topic.status === "contradicted")
  );
}
export function transitionV2(
  stateInput: SimulationState,
  proposalInput: Proposal,
  text: string,
  progress: Progress,
) {
  const state = StateSchema.parse(stateInput),
    proposal = ProposalSchema.parse(proposalInput);
  const result = legacyTransition(state, proposal, text);
  const contradicted = progress.topics.some(
    (topic) => topic.status === "contradicted",
  );
  const answered = progress.topics.filter(
    (topic) => topic.status === "answered",
  ).length;
  // A new conflicting assertion is a meaningful reason to reopen clarification.
  // Mere mentions of policy terms, review or farewells cannot regress a stage.
  const phase =
    result.violation || contradicted
      ? "clarification"
      : state.phase === "next_step"
        ? "next_step"
        : readyForNextStep(state, progress, text)
          ? "next_step"
          : state.phase === "clarification" || answered > 0
            ? "clarification"
            : "discovery";
  return { ...result, state: StateSchema.parse({ ...result.state, phase }) };
}
function nativeRuntime(locale: "hi-IN" | "te-IN") {
  const analyze = (text: string) => canonicalForRules(text, locale);
  return {
    stateSchema: StateSchema,
    initialState,
    analyze,
    revealForInput: (text: string, revealed: SimulationState["revealed"]) =>
      /[?？]|क्या|कितना|क्यों|बताइ|ఎంత|ఎందుకు|చెప్పండి/u.test(text)
        ? revealForInput(analyze(text), revealed)
        : [...revealed],
    unsupportedGuarantee: (text: string) => unsupportedGuarantee(analyze(text)),
    transition: (
      state: SimulationState,
      proposal: Proposal,
      text: string,
      progress?: Progress,
    ) =>
      transitionV2(
        state,
        proposal,
        analyze(text),
        progress ?? progressFor([], analyze(text), 1),
      ),
    progression: true,
    evaluationVersion: "insurance-rubric-v4" as const,
  };
}
export const runtimes = {
  "insurance-v1-rules-v3-hi-IN": nativeRuntime("hi-IN"),
  "insurance-v1-rules-v3-te-IN": nativeRuntime("te-IN"),
  "insurance-v1-rules-v1": {
    analyze: (text: string) => text,
    stateSchema: StateSchema,
    initialState,
    revealForInput,
    unsupportedGuarantee,
    transition: (state: SimulationState, proposal: Proposal, text: string) =>
      legacyTransition(state, proposal, text),
    progression: false,
    evaluationVersion: "insurance-rubric-v3" as const,
  },
  [CURRENT_RUNTIME]: {
    analyze: (text: string) => text,
    stateSchema: StateSchema,
    initialState,
    revealForInput,
    unsupportedGuarantee,
    transition: (
      state: SimulationState,
      proposal: Proposal,
      text: string,
      progress?: Progress,
    ) =>
      transitionV2(state, proposal, text, progress ?? progressFor([], text, 1)),
    progression: true,
    evaluationVersion: "insurance-rubric-v3" as const,
  },
} as const;
export function resolveRuntime(version: string) {
  if (!Object.hasOwn(runtimes, version))
    throw new Error("Unsupported saved runtime version.");
  return runtimes[version as keyof typeof runtimes];
}
