# Evaluation rules

## Current report card: insurance-rubric-v2

Engine: `practice-report-v2`. Every session receives a numeric score, including a 0/100 not-started card for an empty conversation. Each demonstrated check earns 50 category points; concerns and checks without recognized evidence earn zero. The overall score is the rounded fixed-weight sum across all five categories, with evidence coverage shown separately. Partial coverage is provisional, and an unrecognized skill is not described as observed negative behavior.

The v2 rules add bounded recognition of conditional claim approval, previous claim experience questions, and acknowledgement wording. Evidence links still point to exact trainee messages and their recorded events. Original concerns continue to override positive matches.

See [report-card behavior, weights, limitations and verification](REPORT_CARD.md). The rules below document the frozen historical v1 evaluator; old reports are validated with that version and remain unchanged when a separate v2 report is created.

## Historical report: insurance-rubric-v1

Engine: `phrase-evaluation-v1`. This deterministic evaluator makes no model requests. It checks recorded trainee phrases against ten finite rules for the fictional scenario; it is not a general assessment of factual correctness, empathy, legal compliance, or sales ability.

## Scoring and missing evidence

Each category has two equally weighted checks. A check is **demonstrated** (100), **concern** (0), or **insufficient evidence** (unscored). A matched concern overrides positive evidence anywhere in the effective branch history, even if a later turn corrects it. A correction does not erase the recorded earlier decision.

A category score is the average of its two checks only when both are assessed. Otherwise the category remains unscored. The overall score appears only when all ten checks are assessed: round the sum of category score × category weight / 100. Unscored checks are never treated as zero or silently excluded to inflate a total. Coverage is shown separately as assessed checks out of ten. A fully matched fixture can score 100 under these rules; this is not a claim of perfect conversation quality.

| Category                      | Weight | Check 1                                                                                                                                                               | Check 2                                                                                                                                                                             |
| ----------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factual accuracy / compliance | 30%    | Explicit claim review or inability to guarantee approval; matched unsupported guarantees are concerns.                                                                | At least one checked term below; matched contradictory terms are concerns.                                                                                                          |
| Needs discovery               | 20%    | A question containing budget, afford, or monthly cost, with `?`.                                                                                                      | A question about past/previous experience or why Priya is concerned/worried, with `?`.                                                                                              |
| Objection handling            | 20%    | Explicit acknowledgement: “I understand/hear your concern,” “your concern makes sense,” or “that sounds difficult/frustrating.”                                       | An explanation containing a checked exclusion/waiting-period term; matched contradictory terms are concerns.                                                                        |
| Communication                 | 15%    | Every trainee response is at most 70 whitespace-separated words; any longer response is a concern.                                                                    | A permission phrase such as “may I,” “would you like,” “could we,” or “can we”; matched pressure is a concern.                                                                      |
| Appropriate next step         | 15%    | Offer to send/share/review a summary, terms, policy, or writing; or explicitly decline to recommend without/until/before reviewing, understanding or assessing needs. | Offer time or permission (“take your time,” “no need to decide,” “review before you decide,” “would you like,” “may I send”), or the reasoned refusal above; pressure is a concern. |

Checked terms are limited to: **30-day (initial) waiting period**, **cosmetic procedures are excluded**, and **pre-existing conditions have/require a 24-month waiting period**. Obvious matched contradictions include “no waiting period,” negating a 30-day waiting period, and “cosmetic procedures are covered.” Other facts, numbers, paraphrases and contradictions may remain unrecognized. An identified term does not verify the rest of the message.

Matched pressure includes “sign now,” “buy now,” “ignore/skip the terms/exclusions,” and “stop asking.” These phrase rules can misinterpret quotation, context or negation. Guarantee matching uses the same documented narrow heuristic as the simulation reducer. The source in `src/lib/evaluation/rubric.ts` is the exact matcher contract. Multiple checks can legitimately reference the same message; they are separate rubric dimensions, not independent observations of a human skill.

## Scope, evidence and persistence

Reports evaluate the **full effective history** through the saved turn, including inherited prefix messages. Only trainee messages supply skill evidence. Every assessed check has actual trainee message and associated event IDs with a matching turn. References are labelled original, shared through the fork, or after the fork. Positive checks appear as strengths; concerns and missing checks appear as areas to practice. The next practice action addresses the first concern, then the first missing check.

The server creates the report; callers submit only the expected branch revision. It checks browser ownership, supported pinned scenario facts/weights/version, and the current revision. A row lock checks that revision again before persistence. A unique database key `(branchId, branchRevision, rubricVersion)` makes overlapping/repeated evaluation at the same revision return the same immutable saved report.

Saved JSON contains the rubric/engine versions, branch revision, fork boundary, through-turn, full message/event scope and category results. Read validation recomputes the deterministic report from the authorized revision-bounded records, rejecting altered references, weights, scores or findings. Later turns leave old reports intact and mark them outdated. Evaluating the new revision saves a separate report.

GET `/api/branches/:id/evaluation` returns the latest supported saved report or null, with stale/current-revision metadata. POST to the same path accepts only `{ "revision": n }` and enforces origin and ownership. No caller-supplied evidence or scores are accepted. Session deletion cascades to saved reports.

Changing matchers, weights or scoring semantics requires a new rubric/engine version and an explicit scenario/version migration. Current code supports only the documented v1 rubric and its pinned facts/weights; it does not silently apply these rules to a changed policy. No optional model judge is installed. Side-by-side report comparison describes two recorded histories and their coverage, without causal claims or a guaranteed improvement claim.
