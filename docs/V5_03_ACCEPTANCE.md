# V5-03: pinned progression and answered-topic context

Implemented and verified locally October 28, 2026. No schema migration, reseed or rewrite of existing sessions/reports was performed.

## Saved rule dispatch

New sessions pin `insurance-v1-rules-v2` and `insurance-rubric-v3` in their immutable scenario payload and initial snapshot. The original database scenario remains unchanged; the new session factory selects the supported runtime explicitly. The public approved policy facts stay the same.

`progression.ts` resolves the state schema, initial state, reveal function, reducer and compatible evaluation default by the saved runtime identifier. The schema and reveal behavior currently remain shared; their dispatch is explicit so a later rule version cannot silently change an old session. Evaluation creation selects the saved `evaluationVersion`; pre-field sessions use the explicit v3 compatibility default from their runtime (the V5-02 behavior). Saved v1/v2/v3 report validation still selects its original engine.

Legacy sessions pinned to `insurance-v1-rules-v1` continue through the original reducer, including its known stage heuristics. They show a notice with a link to start a new practice for the improved flow. Existing snapshots and forks retain their exact version and state. Unknown runtimes, unsupported evaluation pins, mismatched snapshot versions and incompatible policy facts fail before new generation or authoritative writes. Readable recorded state is not recalculated by playing the transcript through a new reducer.

A fork inherits the session pin and chosen snapshot. It does not silently opt into newer rules. Recorded replay displays actual saved traces; generating a new child response is a new outcome, not deterministic replay of Meta output.

## Progression rules

The new runtime records branch-specific, deterministic topic context for premium, coverage limit, initial waiting period, exclusions/pre-existing conditions and claim review. It is rebuilt from the entire effective branch history, including only shared history before a fork and that branch's subsequent responses. Assistant statements never mark trainee facts answered. Questions alone do not settle facts. Each matched assertion carries its source turn.

An approved assertion marks a topic answered; a recognized conflicting assertion marks it contradicted until a supported correction. **Answered means that a narrow approved-fact phrase was stated, not that the customer agreed, understood every condition or demonstrated competence.** The context tracks the last questions and whether a next-step offer was made. These are bounded English heuristics, not general semantic fact checking. They do not define quality scores.

Discovery advances to clarification when an approved term is stated or a supported contradiction/guarantee requires clarification. A permission-based offer to share/review a policy or summary advances an already clarified conversation to next step only after at least two topics have supporting assertions and there are no unresolved matched contradictions. Merely mentioning review, summary, exclusions or a farewell cannot cause an unrelated jump or regression. A new contradiction can reopen clarification, with its source turn recorded in the topic context.

The same bounded model proposal validation, indicator clamping, guarantee override, optimistic revision checks and atomic turn transaction remain in effect. Topic context is stored in the turn event alongside its rule version, separate from the scoring and length metadata. Failed turns cannot commit partial context or snapshots.

## Repetition behavior

The live Meta developer context now includes the compact topic ledger even when an answer falls outside the recent 24-message dialogue window. Instructions ask Priya to acknowledge answered terms, move to unresolved concerns, challenge contradictions, avoid repeating the last two questions, and respond naturally to a valid review offer or farewell. Approved facts remain authoritative; the ledger does not override policy or expose unrevealed personal knowledge. Genuine requests for clarification and missing conditions remain allowed.

The new deterministic mock uses the same ledger to choose an unresolved topic rather than asking an answered premium question again. Legacy mock behavior stays available for legacy runtime sessions. No model-output seed determinism or universal guarantee against semantic repetition is claimed.

## Acceptance evidence

- **91 ordinary unit checks pass.** The two V5-01 expected-failure stage cases are now ordinary passing tests against the new runtime. Frozen v1 behavior remains independently covered.
- **42 PostgreSQL integration checks pass.** They include exact persisted transitions/context, reload, legacy continuation, parent/child/sibling context isolation, private reveal isolation, unsupported/mismatched pins, incompatible policy facts and pinned evaluation dispatch.
- **33 distinct Chrome browser checks are covered by passing runs.** The full suite passed 32 checks; the new progression test initially compared the entire session response after adding a fork, incorrectly expecting the branch catalog not to grow. It was corrected to assert unchanged parent messages/events/snapshots/state and the expected new branch; the targeted rerun passed. No application change was needed for that test correction.
- **Five real Meta turns passed.** Replies acknowledged the fixed premium, advanced to exclusions/coverage/documentation, accepted a review offer and closed naturally. No literal duplicate questions occurred; inspection also found no repeated resolved premium/initial-wait question in this sample. The final two states remained `next_step`. All generated messages had Meta metadata, rule versions matched, and exact reload passed. The synthetic session was deleted after verification. Aggregate evidence is in `verification/v5-03/live.json`; private credentials and complete transcripts are not checked in.
- Localhost restart verified the legacy notice and new-session behavior, with zero unexpected navigations or HMR reloads during a 20-second observation. No model request was made for that UI smoke check.
- Lint, TypeScript, production build, `git diff --check`, configuration and production client privacy scan pass. No AWS deployment was performed.

Repeat the paid live sample only intentionally:

```sh
PERSONA_VERIFY_LIVE=1 npm run verify:progression:live
```

The opt-in verifier requires the local database and existing private Meta configuration, makes five real generation requests, checks metadata/persistence, and removes its synthetic session. This sample validates observed behavior; broader model behavior still needs ongoing review.

Next: V5-04, additive locale/modality metadata. Hindi, Telugu, voice, camera and other future capabilities remain gated off.
