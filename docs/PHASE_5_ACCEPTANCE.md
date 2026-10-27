# Phase 5 — Evidence-grounded evaluation acceptance

Completed locally October 27, 2026. Deterministic evaluation uses recorded fictional conversations; no additional Meta or judge calls were made. The running app remains configured for Meta conversation generation.

## Delivered

- Five weighted rubric categories (30 / 20 / 20 / 15 / 15) with ten documented phrase checks, explicit missing-evidence states, rule explanations, strengths, areas to practice, and a next action.
- Message/event evidence from the full effective branch history, labelled original, shared, or after-fork. Exact evidence links work both within the practice drawer and when following a comparison report into practice.
- Immutable reports keyed by branch/revision/rubric version, server-side generation, authorization and revision checks, persistence and read-time evidence validation.
- Outdated-report notices after new turns, plus a separate report for the current revision. Comparison can evaluate/display each path independently.
- A new native PostgreSQL migration adds report-revision uniqueness. No provider dependency or supplemental model judge was introduced.

## Acceptance results

| Requirement            | Verified result                                                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documented scoring     | A fixture demonstrating all ten phrase checks scores 100. Adding an unsupported guarantee makes claim-boundaries a concern, accuracy 50, and the weighted overall 85. Empty/partial histories stay unscored where evidence is missing.                      |
| Actual evidence        | Assessed checks resolve to the correct trainee messages and associated event IDs/turns. Assistant dialogue cannot supply trainee skill evidence.                                                                                                            |
| Evidence rejection     | Unit checks reject altered message IDs, event IDs, turns, branch scope, weights and scores. Database read validation rejects corrupted/foreign references. The API rejects caller-supplied findings.                                                        |
| Revision integrity     | Concurrent evaluation returns one report ID. Old reports remain unchanged after another turn and are marked stale. A forced race that commits a turn between report computation and persistence rejects the stale evaluation with 409 and writes no report. |
| Full inherited history | Fork evaluation includes the shared prefix, labels inherited guarantee evidence as shared, and labels new policy-term evidence after the fork. Parent reports remain unchanged.                                                                             |
| Appropriate outcomes   | A reasoned refusal to recommend pending review satisfies the next-step checks; a sale is not required. Pressure language is a concern.                                                                                                                      |
| Pinned rules           | Changed pinned facts cannot silently use the fixed v1 evaluator. Unsupported policy/rubric inputs return 422.                                                                                                                                               |
| Browser behavior       | Desktop/mobile flows generate a report, follow exact evidence, reload the same report, continue the conversation, see the stale notice, and evaluate a new revision. Unauthorized GET/POST fail. Comparison reports retain distinct branch scope.           |
| Presentation           | Reviewed 1440 × 1000 and 390 × 844 report captures, no horizontal overflow, and two additional selected-rule axe scans pass. This is not full accessibility certification.                                                                                  |

## Verification

- `npm test`: 40 unit checks passed.
- `npm run test:integration`: 18 native PostgreSQL checks passed.
- `npm run test:e2e`: 13 browser checks passed in 36.5 seconds.
- Lint, TypeScript, production build, migration status, client privacy scan, and restarted local HTTP check: recorded in phase status.

New tests delete only their own sessions and cascade their reports. Evidence artifact IDs are historical references after cleanup. Earlier-phase artifacts are retained as historical evidence rather than overwritten by routine test reruns.

## Evidence

- [Exact scoring and versioning contract](EVALUATION_RULES.md).
- [Unit evaluation checks](../tests/unit/evaluation.test.ts), [PostgreSQL acceptance](../tests/integration/evaluation.test.ts), and [browser acceptance](../tests/e2e/evaluation.spec.ts).
- [Production smoke evidence](verification/phase-5/production.json): opening-only report remains unscored, persists, and denies unauthorized reads, with no generation call.
- [Desktop report evidence](verification/phase-5/desktop.json) and [mobile report evidence](verification/phase-5/mobile.json), including before/after revision reports and checks.
- [Desktop report screenshot](screenshots/phase-5/evaluation-desktop.png) and [mobile report screenshot](screenshots/phase-5/evaluation-mobile.png).

## Limits and next phase

These finite English phrase checks do not establish comprehensive factual accuracy, psychological skills, legal compliance or causal effects. Unsupported wording can remain unassessed; quotations/negations can be misclassified. A score is labelled rule coverage, and missing evidence is shown rather than fabricated. The original branch's later correction does not erase an earlier flagged guarantee. Public deployment and broad human evaluation remain pending.

Next: Phase 6 — complete journey polish, accessibility and device acceptance.
