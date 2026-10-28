// Frozen v1 rules: retained to verify historical reports without rewriting them.
import { z } from "zod";
import {
  unsupportedGuarantee,
  type TranscriptMessage,
} from "@/lib/simulation/domain";

export const RUBRIC_VERSION = "insurance-rubric-v1";
export const ENGINE_VERSION = "phrase-evaluation-v1";
const EvidenceSchema = z
  .object({
    messageId: z.string(),
    eventId: z.string(),
    turn: z.number().int().positive(),
    scope: z.enum(["original", "shared", "after_fork"]),
  })
  .strict();
const CheckSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    status: z.enum(["demonstrated", "concern", "insufficient"]),
    feedback: z.string(),
    evidence: z.array(EvidenceSchema),
  })
  .strict();
export const ReportSchema = z
  .object({
    rubricVersion: z.literal(RUBRIC_VERSION),
    engineVersion: z.literal(ENGINE_VERSION),
    scope: z
      .object({
        branchId: z.string(),
        revision: z.number().int().nonnegative(),
        throughTurn: z.number().int().nonnegative(),
        forkTurn: z.number().int().nonnegative().nullable(),
        messageIds: z.array(z.string()),
        eventIds: z.array(z.string()),
      })
      .strict(),
    categories: z
      .array(
        z
          .object({
            id: z.string(),
            label: z.string(),
            weight: z.number(),
            score: z.number().min(0).max(100).nullable(),
            checks: z.array(CheckSchema),
          })
          .strict(),
      )
      .length(5),
    overall: z.number().min(0).max(100).nullable(),
    assessedChecks: z.number().int().min(0).max(10),
    totalChecks: z.literal(10),
    nextAction: z.string(),
  })
  .strict();
export type EvaluationReport = z.infer<typeof ReportSchema>;
export type EvaluationHistory = {
  messages: TranscriptMessage[];
  events: { id: string; turn: number; payload: unknown }[];
};
const definitions = [
  {
    id: "accuracy",
    label: "Factual accuracy / compliance",
    weight: 30,
    checks: ["claim-boundaries", "approved-terms"],
  },
  {
    id: "discovery",
    label: "Needs discovery",
    weight: 20,
    checks: ["budget-question", "experience-question"],
  },
  {
    id: "objections",
    label: "Objection handling",
    weight: 20,
    checks: ["acknowledgement", "limits-explained"],
  },
  {
    id: "communication",
    label: "Communication",
    weight: 15,
    checks: ["concise-response", "collaborative-language"],
  },
  {
    id: "nextStep",
    label: "Appropriate next step",
    weight: 15,
    checks: ["review-offer", "unpressured-choice"],
  },
] as const;
const matches = (re: RegExp) => (m: TranscriptMessage) => re.test(m.content);
const guarantee = (m: TranscriptMessage) => unsupportedGuarantee(m.content);
// Deliberately narrow rules for this fictional scenario, not general factual verification.
const approvedTerms = matches(
  /\b30[- ]day (?:initial )?waiting period\b|\bcosmetic procedures (?:are )?excluded\b|\bpre-existing conditions (?:have |require )?(?:a )?24[- ]month waiting period\b/i,
);
const conflictingTerms = matches(
  /\bno waiting period\b|\bcosmetic procedures (?:are )?covered\b|\b(?:no|not|isn't|is not) (?:a )?30[- ]day waiting period\b/i,
);
const clearLimits = matches(
  /\bclaims? (?:are |is )?(?:reviewed|assessed)\b|\b(?:cannot|can't|never|not) guarantee (?:claim )?approval\b|\bapproval is (?:never|not) guaranteed\b/i,
);
const pressure = matches(
  /\b(?:sign|buy) now\b|\b(?:ignore|skip) (?:the )?(?:terms|exclusions)\b|\bstop asking\b/i,
);
const refusal = matches(
  /\b(?:cannot|can't) recommend\b.{0,90}\b(?:without|until|before)\b.{0,70}\b(?:review|understand|assess)/i,
);

export function evaluate(
  history: EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
): EvaluationReport {
  const users = history.messages.filter((m) => m.role === "user");
  const references = (records: TranscriptMessage[]) =>
    records.map((m) => {
      const event = history.events.find(
        (e) =>
          e.turn === m.turn &&
          (e.payload as { messageId?: string } | null)?.messageId === m.id,
      );
      if (!event)
        throw new Error("Evaluation evidence is missing its recorded event.");
      return {
        messageId: m.id,
        eventId: event.id,
        turn: m.turn,
        scope:
          scope.forkTurn === null
            ? ("original" as const)
            : m.turn <= scope.forkTurn
              ? ("shared" as const)
              : ("after_fork" as const),
      };
    });
  function check(
    id: string,
    label: string,
    positive: (m: TranscriptMessage) => boolean,
    negative: (m: TranscriptMessage) => boolean,
    guidance: string,
  ) {
    const concerns = users.filter(negative),
      supported = users.filter(positive);
    const status = concerns.length
      ? ("concern" as const)
      : supported.length
        ? ("demonstrated" as const)
        : ("insufficient" as const);
    return {
      id,
      label,
      status,
      feedback: guidance,
      evidence: references(concerns.length ? concerns : supported),
    };
  }
  const noConcern = () => false;
  const checks = [
    check(
      "claim-boundaries",
      "Explain claim review without guarantees",
      clearLimits,
      guarantee,
      "Explicitly explain that claims are reviewed or approval cannot be guaranteed. Any matched unsupported guarantee makes this check a concern, even after a correction.",
    ),
    check(
      "approved-terms",
      "State a checked policy term",
      approvedTerms,
      conflictingTerms,
      "State one checked fictional term: 30-day waiting period, cosmetic procedures excluded, or 24-month waiting period for pre-existing conditions. Matched contradictory phrases override positive evidence; other facts remain unverified.",
    ),
    check(
      "budget-question",
      "Ask about budget",
      (m) =>
        m.content.includes("?") &&
        /\b(?:budget|afford|monthly cost)\b/i.test(m.content),
      noConcern,
      "Ask a direct question about budget, affordability or monthly cost; this rule requires a question mark.",
    ),
    check(
      "experience-question",
      "Ask about prior concerns",
      (m) =>
        m.content.includes("?") &&
        /\b(?:past experience|previous experience|why (?:are you |you are )?(?:concerned|worried))\b/i.test(
          m.content,
        ),
      noConcern,
      "Ask about past/previous experience or why Priya is concerned, with a question mark.",
    ),
    check(
      "acknowledgement",
      "Acknowledge the concern",
      matches(
        /\bI (?:understand|hear) your concern\b|\byour concern makes sense\b|\bthat sounds (?:difficult|frustrating)\b/i,
      ),
      noConcern,
      "Acknowledge the concern explicitly, such as 'I understand your concern.' This check does not measure empathy.",
    ),
    check(
      "limits-explained",
      "Address the policy limits",
      approvedTerms,
      conflictingTerms,
      "Address the objection with a checked exclusion or waiting-period explanation, using the approved fictional terms.",
    ),
    check(
      "concise-response",
      "Keep responses readable",
      (m) => m.content.trim().split(/\s+/).length <= 70,
      (m) => m.content.trim().split(/\s+/).length > 70,
      "Every recorded trainee response must be 70 words or fewer. This measures length only, not the meaning or quality of the language.",
    ),
    check(
      "collaborative-language",
      "Use collaborative language",
      matches(/\b(?:may I|would you like|could we|can we)\b/i),
      pressure,
      "Use an explicit permission phrase such as 'may I' or 'could we'. Matched pressure phrases such as 'sign now' override positive evidence.",
    ),
    check(
      "review-offer",
      "Offer review or a reasoned pause",
      (m) =>
        refusal(m) ||
        (/\b(?:send|share|review)\b/i.test(m.content) &&
          /\b(?:summary|terms|policy|writing)\b/i.test(m.content) &&
          !/\b(?:don't|do not|never) (?:send|share|review)\b/i.test(m.content)),
      pressure,
      "Offer a written summary/terms review, or explicitly decline to recommend until needs or terms are reviewed. No sale is required.",
    ),
    check(
      "unpressured-choice",
      "Leave the next decision open",
      (m) =>
        refusal(m) ||
        /\b(?:take your time|no need to decide|review before (?:you )?decid|would you like|may I send)\b/i.test(
          m.content,
        ),
      pressure,
      "Offer time or permission before the next step, or explicitly pause a recommendation pending review. Matched pressure language is a concern.",
    ),
  ];
  const categories = definitions.map((definition) => {
    const selected = definition.checks.map((id) =>
      checks.find((c) => c.id === id)!,
    );
    return {
      id: definition.id,
      label: definition.label,
      weight: definition.weight,
      checks: selected,
      score: selected.some((c) => c.status === "insufficient")
        ? null
        : selected.filter((c) => c.status === "demonstrated").length * 50,
    };
  });
  const firstGap =
    checks.find((c) => c.status === "concern") ??
    checks.find((c) => c.status === "insufficient");
  return ReportSchema.parse({
    rubricVersion: RUBRIC_VERSION,
    engineVersion: ENGINE_VERSION,
    scope: {
      ...scope,
      throughTurn: Math.max(0, ...history.messages.map((m) => m.turn)),
      messageIds: history.messages.map((m) => m.id),
      eventIds: history.events.map((e) => e.id),
    },
    categories,
    overall: categories.some((c) => c.score === null)
      ? null
      : Math.round(
          categories.reduce((sum, c) => sum + (c.score! * c.weight) / 100, 0),
        ),
    assessedChecks: checks.filter((c) => c.status !== "insufficient").length,
    totalChecks: 10,
    nextAction: firstGap
      ? firstGap.feedback
      : "All ten phrase checks have evidence. Revisit a decision and try another grounded response; these checks do not establish overall conversation quality.",
  });
}

export function validateEvidence(
  value: unknown,
  history: EvaluationHistory,
  scope: { branchId: string; revision: number; forkTurn: number | null },
) {
  const report = ReportSchema.parse(value);
  // Recompute the deterministic report from the authorized, revision-bounded records.
  // This rejects fabricated IDs, foreign scope, changed weights/scores and altered findings.
  const expected = evaluate(history, scope);
  if (JSON.stringify(report) !== JSON.stringify(expected))
    throw new Error(
      "Evaluation evidence or scope does not match the recorded history.",
    );
  return report;
}
