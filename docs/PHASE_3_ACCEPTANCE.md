# Phase 3 — State and timeline acceptance

Completed locally October 27, 2026. Checks use deterministic mock generation with native PostgreSQL; Phase 2's separately recorded live Meta acceptance remains in [its report](PHASE_2_ACCEPTANCE.md).

## Changes and acceptance

| Criterion                         | Evidence                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bounded, authoritative state      | Strict schemas reject out-of-range deltas and model attempts to set phase, violations, or revealed facts. Repeated extreme valid proposals keep every indicator between 0 and 100. Guarantees override favorable model proposals.                                                                        |
| Explicit knowledge rules          | Reveals are cumulative and unique. Mock replies now require the same server-authorized knowledge as live prompts. A near-match such as “What concerns you most?” no longer reveals the friend's story while the server's narrow rule leaves it hidden.                                                   |
| Ordered, unique persisted history | Four committed turns have message sequences 0–8, event sequences 1–4, snapshots 0–4, and exactly four idempotency records. Each event resolves to the actual trainee message; guarantee findings reference stored trainee messages.                                                                      |
| Duplicate-request safety          | A barrier forces identical-key requests to finish generation before either writes. Both return the single committed turn; a later retry does not regenerate. Reusing that key for different text returns 409 without changes.                                                                            |
| Stale-write rejection             | Different-key requests overlap at the same revision: exactly one commits, one receives 409. An already-stale request fails before generation. No losing message/event/snapshot/request commits.                                                                                                          |
| Atomic rollback                   | Existing event-write collision test passes. A new real PostgreSQL snapshot uniqueness collision, inserted after history is read, causes failure later in the transaction: revision, both messages, event and idempotency write all roll back. The deliberately conflicting fixture is removed afterward. |
| Exact saved-state restoration     | A branch before budget disclosure restores that snapshot's state, shared message/event IDs, and permitted knowledge. Later parent disclosures are absent from the child's provider input; the parent's recorded history stays unchanged. Existing nonzero/nested fork checks also pass.                  |
| Timeline boundaries               | Browser checks verify ordered markers, the current saved state, exact preview confidence/flags, and reload persistence. Message rewind selects the snapshot immediately before that response; a timeline marker selects the state after its numbered decision.                                           |

The audit fixed clarification matching for complete words including “exclusions,” “claims,” “coverage,” and “covered.” It also corrected the percentage boundary so “100% approval” triggers the documented narrow guarantee heuristic. Initial snapshot context and opening-message version metadata now come from the selected persisted scenario definition/version.

These are corrections to the current v1 rules. Previously saved snapshots are read as recorded and are not recomputed or rewritten. Context version labels identify the scenario context; they do not pin an executable historical reducer binary. Generated alternatives use the currently installed implementation. Exact stored-state restoration does not promise reproducible model generation.

## Validation

- `npm test`: **22 passed**.
- `npm run test:integration`: **9 passed**, including six new Phase 3 acceptance tests.
- `npm run test:e2e`: **7 passed in 24.8 seconds**, including the new timeline acceptance check and existing desktop/mobile/accessibility journeys.
- `npm run lint`, `npm run typecheck`, and `npm run build`: passed.
- Production client-bundle privacy scan and restarted local HTTP check: recorded in phase status.

New integration tests create isolated sessions and delete them after each test, checking absence. The browser acceptance test deletes only its own session in `finally`. Three fixtures left by an initial test-harness cleanup error were identified and removed by exact ID and owner; the corrected harness passed. No real Meta calls were made for this acceptance run.

## Evidence and reproduction

- [PostgreSQL acceptance tests](../tests/integration/state-acceptance.test.ts).
- [Domain tests](../tests/unit/domain.test.ts) and [provider boundary tests](../tests/unit/providers.test.ts).
- [Browser timeline check](../tests/e2e/timeline.spec.ts).
- [Structured timeline result](verification/phase-3/timeline.json).
- [Saved-state preview screenshot](screenshots/phase-3/saved-state-preview.png), explicitly labelled mock mode.

Run the validation commands above from the repository root with local PostgreSQL and the seeded scenario. End-to-end tests use a separate mock server on port 3101. These checks make no provider requests.

## Remaining boundaries

Knowledge matching and guarantee detection are limited phrase rules, not exhaustive language understanding or compliance checking. Simulation indicators are not psychological measurements. Duplicate concurrent requests may both incur provider work, but only one turn commits. Scenario context is versioned and stored; executable rule-version dispatch is not implemented. Formal Phase 4 branch/comparison acceptance, Phase 5 rubric evaluation, deployment controls, and public release remain open.

Next: Phase 4 — rewind, independent branches, and comparison acceptance.
