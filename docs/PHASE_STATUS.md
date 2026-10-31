# PERSONA LAB — Actual implementation status

Updated October 31, 2026. This is local evidence, not public-release acceptance.

## V5 progress

**Latest: V5-10 private audio/video reference sources implemented locally.** Scenario Studio now supports private short-clip upload, Meta audio transcription or manual entry, immutable transcript review/history, reviewed source attachment, operator publication checks, owner-only playback and retention/deletion cleanup. Additive migration and backup/restore passed; current software/live evidence is in [V5-10 acceptance](V5_10_ACCEPTANCE.md). Own-clip human acceptance and AWS deployment remain pending.

**V5-09 Simli localhost controls accepted by the user on October 31.** Enable video → Auto speak during connection → Wait without premature audio, lip-sync, Stop/Replay and recording interruption passed by user report. Language/browser/device details were not specified. The independent new-turn live journey and AWS Ubuntu speech/deployment remain pending. See [Simli verification](V5_09_SIMLI.md).

**V5-06 local implementation and export verification are complete; human acceptance remains pending.** Added the corrected, versioned Indic evaluator, native report companions, shaped PDF output, embedded Word fonts and native sharing summaries. Older reports are retained. The user volunteered to review Telugu; approval is not yet recorded and Hindi needs a reviewer. See [V5-06 acceptance](V5_06_ACCEPTANCE.md).

**Historical V5-05 software/live verification passed; release acceptance is pending.** Added language selectors with explicit English interface/coaching fallback, Hindi/Telugu draft content, native rule/evaluation adapters, pinned translations and bundled Indic UI fonts. Validation: 108 unit, 50 database, 34 English browser and four native browser checks; final live run included five original plus one independent Meta alternative per locale. **Hindi/Telugu remain gated pending native-speaker review and V5-06 Indic export acceptance.** Read [V5-05 acceptance](V5_05_ACCEPTANCE.md) and [the translation review packet](reviews/V5_05_TRANSLATIONS.md).

V5-04 is complete locally: additive metadata migration, immutable English localization reference, pinned settings/source/report locales, owned preferences and future consent/provenance contracts. All original columns across 1,059 product rows verified unchanged; backup/restore passed before and after migration. Validation: 100 unit, 47 database and 34 browser checks, clean install/idempotent seed, lint/typecheck/build/privacy scan. See [V5-04 acceptance](V5_04_ACCEPTANCE.md). Next: V5-05; only English text is enabled.

V5-03 is complete locally: runtime/evaluation dispatch, explicit stage milestones, branch-specific answered-topic context, legacy rule preservation and five verified live Meta turns. Validation: 91 ordinary unit checks, 42 database checks, 33 browser checks across full/targeted runs, and passing lint/typecheck/build/privacy scan. See [V5-03 acceptance](V5_03_ACCEPTANCE.md). **Start a new practice to use the new conversation rules.** Next: V5-04.

V5-02 is complete locally: shared 70-word admission, atomic validation metadata, preserved historical retries, v3 nine-check quality scoring and separate length in reports/exports. Validation: 85 unit checks including two known expected failures, 35 database checks, 32 distinct browser checks across baseline and targeted reruns, and passing lint/typecheck/build/privacy scan. See [V5-02 acceptance](V5_02_ACCEPTANCE.md). Next: V5-03 progression and versioned runtime.

V5-01 is complete locally: verified isolated restore (10 tables, 873 snapshot rows), fail-closed capability gates and frozen legacy/regression fixtures. Refreshed validation: 68 ordinary unit passes plus two expected known-defect cases, 27 integration passes, 29 browser passes plus one cleanup connection reset that passed on isolated rerun, and passing lint/typecheck/build/privacy scan. No migrations or historical report rewrites. See [V5-01 evidence](V5_01_BASELINE.md). Next is V5-02.

## Phase progress

| Phase                      | Status                        | Delivered / remaining                                                                                                                                                                                                                                                                       |
| -------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundation             | Local foundation delivered    | Dedicated Git repository and origin, Next.js/TypeScript tooling, PostgreSQL role/database, Prisma migration, seed, mock and documented Meta adapters. Live Meta access and Phase 2 conversation acceptance verified locally.                                                                |
| 1 — Design system          | Complete                      | Cohesive studio/practice/comparison, documented tokens, active navigation, mobile context disclosure, vertical timeline, shared-history split, branch selectors, keyboard focus/return, reduced motion, and honest loading/error/empty states. Acceptance: `PHASE_1_ACCEPTANCE.md`.         |
| 2 — Persisted conversation | Complete locally with Meta    | Five live turns, exact reload/resume, sixth turn, access isolation, draft recovery and genuine provider failure without partial writes. Acceptance: `PHASE_2_ACCEPTANCE.md`.                                                                                                                |
| 3 — State/timeline         | Complete locally              | Bounded state, resolving evidence, exact saved-state previews, forced overlapping retries/stale writes, late-write rollback, and knowledge-boundary checks passed. Rule matching corrected. Acceptance: `PHASE_3_ACCEPTANCE.md`.                                                            |
| 4 — Branching/comparison   | Complete locally              | Exact saved-state/prefix restoration, independent parent/sibling/nested paths, access isolation, evidence links, per-turn recorded state changes, unequal-length notices, and responsive replay/resumption. Acceptance: `PHASE_4_ACCEPTANCE.md`.                                            |
| 5 — Evaluation             | Complete locally              | Versioned five-category phrase rubric, explicit insufficient evidence, message/event references, immutable revision-scoped reports, stale notices, inherited finding scope, strengths/next actions and comparison reports. Acceptance: `PHASE_5_ACCEPTANCE.md`.                             |
| 6 — Polish/accessibility   | Local implementation accepted | Portrait-led studio and editorial workspace redesign, prominent evaluation, focus transfer, recovery states, 320px reflow, larger text and forced colors verified. Native zoom, VoiceOver and physical-phone checks passed by user report; separate timing/platform details are not recorded. See: `PHASE_6_ACCEPTANCE.md`. |
| 7 — Deployment/release     | Local release checks passed   | Shared PostgreSQL admission, atomic creation quotas, streamed request bounds, expiry cleanup command, build/privacy scan and full localhost live Meta journey passed. AWS Ubuntu deployment and scheduled cleanup remain pending.                                                           |
| 8 — Demo/submission        | Not started                   | Deferred at the user's request while V5 requirements are planned; no demonstration video or organizer submission.                                                                                                                                                                                                                                             |

## V5 planning handoff

The supplied V5 brief has been analyzed against the current code. See [the step-by-step V5 gap analysis and migration plan](V5_IMPLEMENTATION_PLAN.md). This is a planning-only update: no V5 product code or database migration has been applied. Priorities are independent 70-word admission/quality scoring, versioned scenario behavior, English/Hindi/Telugu text and reports, then verified voice with a 2D avatar. Camera, additional languages, 3D and team administration remain gated later work. Existing Phase 8 remains deferred at the user's request; AWS remains pending.

## October 28 product updates

- Light theme and persistent accessible theme toggle added, preserving the original dark palette. Nine theme checks passed across Chrome, Firefox and WebKit.
- Localhost and 127.0.0.1 aliases work on the configured development protocol/port; production origin matching remains exact. Both browser journeys and origin rejection cases passed.
- Every session can generate a numeric v2 report card, including empty and partial conversations, with evidence-linked positives, observed concerns, separate evidence gaps and an improvement plan. Historical v1 reports remain verifiable and unchanged. Selected wording false negatives were corrected.
- PDF and editable Word exports include scores, feedback, scope and selected evidence. The reviewed exports were rendered and visually inspected. Email/WhatsApp summaries and native attachment sharing are available with a download-and-attach fallback; no server-side sending is configured. The user subsequently reported sharing acceptance working on October 28.
- Latest checks: 55 unit tests passed. The report-card change passed 27 database tests and the full 28-test Chrome suite. Export changes passed nine targeted browser checks plus a final export regression. Lint, TypeScript, production build and client privacy checks passed. See `REPORT_CARD.md` for scoring, sharing behavior and evidence boundaries.
- Open product findings: repetitive character questions and heuristic conversation-stage transitions. Native zoom, VoiceOver, physical-phone and sharing checks are now accepted by user report. Device/version details were not supplied. AWS deployment has not been performed.

## October 28 Phase 6 review follow-up

- Page titles, composer focus, pointer-opened dialog focus and HTTP phone-review retry keys repaired.
- Eight acceptance checks passed in each of Chrome, Firefox and WebKit (24 executions). 48 unit and 26 integration tests passed, including a real UTC window-duration assertion. Lint, typecheck, production build and client privacy checks passed. Four migrations are applied.
- A dedicated temporary mock server is available for the user’s physical phone review; the live app remains on loopback port 3100. Automated runs have independent mock admission namespaces. Existing admission-window expiry was normalized without resetting counts.
- At the original review these human results were pending. The user has now reported VoiceOver, native zoom and physical-phone checks working; sharing is also accepted by user report. Separate platform inventory and comprehension timing were not supplied. See `PHASE_6_MANUAL_REVIEW.md`.

## Latest Phase 7 local results

- 47 unit tests, 26 PostgreSQL integration tests, and all 19 mock browser tests passed.
- The production live Meta journey passed in 1.1 minutes: seven actual generations, five initial turns, reload/resume, private knowledge boundaries, outsider access denial, an independent fork and comparison. Its fictional test session was deleted.
- Lint, typecheck, production build, all three applied migrations, and the client privacy/configuration scan passed (16 production client files).
- The expiry cleanup CLI ran successfully with zero expired sessions/counters to delete. Integration checks separately prove actual deletion of an expired forked aggregate and preservation of active data.
- Initial browser execution hit a generated-cache ENOSPC error. After clearing `.next-dev`, all 19 browser tests passed in 47.5 seconds. Historical phase artifacts were restored; current mock captures are under `screenshots/phase-7/mock/`.
- AWS was not modified. Local command availability does not mean expiry cleanup is scheduled. Phase 6 native/device checks remain open.
- Evidence: `verification/phase-7/local-release.json`, `verification/phase-7/live-conversation.json`; handoff: `PHASE_7_LOCAL_RELEASE.md`.

## Earlier verification performed

- `npm install --no-audit --no-fund`: dependencies installed successfully.
- `npm run db:setup`: dedicated local role/database created; generated credentials saved privately without printing them.
- `npm run db:migrate`: initial migration applied successfully to native PostgreSQL 15.17.
- `npm run db:seed`: fictional scenario seeded successfully; seed is idempotent.
- `npm run lint`: passed with no errors or warnings.
- `npm run typecheck`: passed.
- `npm test`: 44 unit tests passed, including four new connection/response recovery checks. Evaluation, domain, provider and comparison checks continue to pass.
- `npm run test:integration`: 19 PostgreSQL tests passed, including actual expiry denying list/read/continuation without committing a turn. Earlier state, branching and evaluation checks also pass.
- `npm run test:e2e`: 18 Playwright tests passed on isolated mock port 3101 in 47.5 seconds. The added forced-colors test then passed in a targeted run, making 19 passing browser checks. See Phase 6 for keyboard rehearsal, focus, reflow, recovery and preference coverage.
- `PERSONA_LIVE_VERIFY=1 npm run verify:live`: 2 live browser tests passed in 47.5 seconds, with seven successful Meta generations and one genuine invalid-credential failure. Test sessions were deleted; the temporary failure server was stopped. See `PHASE_2_ACCEPTANCE.md`.
- Phase 1: 9 axe scans passed with no violations under the selected WCAG 2 A/AA and 2.1 AA rules across desktop/mobile screens and open drawers. This is not full accessibility certification.
- Phase 6: nine additional axe scans passed selected WCAG 2 A/AA, 2.1 AA and 2.2 AA rules, with focus/reflow checks and an additional forced-colors preference test. Native audible/device testing remains open.
- Phase 5: two further selected-rule axe scans passed on the evaluated report drawer, with no horizontal overflow.
- Phase 4: two additional axe scans passed the selected WCAG rules on the expanded comparison screens; desktop/mobile captures were reviewed.
- Six browser captures at 1440 × 1000 and 390 × 844 were reviewed; see `PHASE_1_ACCEPTANCE.md`.
- `npm run build`: passed after the final source changes.
- Production client-bundle scan after the Phase 6 build: no matches for the actual private key/database URL, private budget/history instructions, `privateKnowledge`, or `META_API_KEY` across 13 JavaScript chunks in `.next/static/chunks`.
- Local production evaluation smoke: opening-only history stays unscored, saved report reloads, unauthorized read returns 404; the session/report were deleted. No model request. Evidence: `docs/verification/phase-5/production.json`.
- `npm run db:migrate`: evaluation revision uniqueness migration applied; `npx prisma migrate status` confirms both migrations are up to date.
- The updated local production server was restarted at `http://127.0.0.1:3100` after Phase 6 and returned HTTP 200 in Meta mode. Phase 2 live-generation evidence is recorded separately; Phases 3–6 used mock generation; evaluation makes no provider calls.
- `.env` is Git-ignored with filesystem permissions `0600`.

The first seed attempt exposed ESM configuration and environment-loading issues; both were corrected and the seed rerun successfully. Early lint findings were corrected before the final passing run. A desktop composer-position issue was corrected and covered by an in-viewport assertion. A shared scenario-module boundary was split so private character facts stay in server-only code.

## Current constraints

- The local app now uses `AI_PROVIDER=meta`. Mock mode remains available for deterministic development and tests.
- Seven generated responses were verified as Meta Muse Spark 1.3, including a resumed sixth turn and an independent alternative. Genuine upstream 401 handling passed on an isolated server. These checks establish local acceptance for the tested scenario, not public deployment.
- Character budget/history facts are available to the model only after explicit reveal rules. Public client components import a separate public scenario definition.
- Saved scenario context versions do not select historical executable reducers; old snapshots are replayed as stored, while new turns use the current code.
- Evaluation uses ten limited English phrase rules. V2 category and overall practice scores are always numeric; missing recognized evidence earns zero, with coverage and provisional status shown separately. Historical v1 reports retain their original nullable scores. Neither version is a complete skill/compliance assessment.
- Guarantee detection uses a narrow transparent phrase heuristic. No claim of exhaustive accuracy, psychological measurement, real-world prediction, or proven causality is made.
- Session access expires after 30 days. The bounded physical purge command is implemented and tested; scheduling and monitoring remain pending for AWS. Clearing the browser ownership cookie loses access.
- PostgreSQL-backed global/browser generation admission and shared creation admission are implemented, as are transactionally enforced session/branch quotas. Browser identity can be reset; AWS edge abuse controls and deployed limits still require acceptance.
- Prisma 6 emits a configuration deprecation notice. It is pinned and working; a future major upgrade needs a deliberate configuration migration.

## Next implementation increment

1. Follow the V5 plan: refresh the preserved English baseline, then implement the shared 70-word admission rule and independent length metadata/quality scoring.
2. Complete versioned runtime, locale, English/Hindi/Telugu text, coaching and export acceptance before voice or camera.
3. Keep AWS deployment pending until the chosen local release slice is accepted. Existing Phase 8 demo/submission is deferred at the user's request.

## Visual evidence and assets

- `docs/screenshots/studio-desktop.png`: initial local studio screenshot.
- `docs/screenshots/phase-6/`: reviewed redesigned studio/workspace/report/comparison, reflow, larger-text and forced-colors captures; structured evidence in `docs/verification/phase-6/`.
- `docs/screenshots/phase-5/`: reviewed desktop/mobile evaluation captures; saved revision reports in `docs/verification/phase-5/`.
- `docs/screenshots/phase-4/`: reviewed desktop/mobile recorded comparisons; structured results in `docs/verification/phase-4/`.
- `docs/screenshots/phase-3/`: reviewed saved-state preview; structured timeline evidence in `docs/verification/phase-3/`.
- `docs/screenshots/phase-2/`: live conversation, comparison, and retained draft captures; structured evidence in `docs/verification/phase-2/`.
- `docs/screenshots/phase-1/`: reviewed desktop/mobile studio, practice, and comparison captures (labelled mock mode).
- `public/images/priya.webp`: original fictional portrait generated with the built-in image tool; prompt/provenance in `docs/ASSETS.md`.

The software is MIT-licensed. Git delivery status is reported in the final handoff; a local commit does not prove a push or deployment.

## V5-07 — edition library and text authoring

Local implementation: [acceptance and operator workflow](V5_07_ACCEPTANCE.md). Edition/goal/role/difficulty filters, private revisioned drafts and OS-operator review/publication extend the verified English insurance template. Published versions are immutable; existing sessions remain pinned. Personal templates, native-language authoring, voice/media and generic new-role runtimes remain unavailable. V5-06 human language/target-reader approvals and AWS deployment remain pending.

## V5-08 — speech and consent

Local implementation and real Meta Muse Voice Transcribe access verified; [acceptance](V5_08_ACCEPTANCE.md). English microphone check uses explicit consent, ephemeral PCM audio, editable/confirmed transcripts and optional local-device readback. Microphone operation and clear audible playback passed by direct user reports on October 30, 2026. V5-08’s English localhost check is accepted. Device/browser and detailed accuracy/stop behavior were not supplied. Meta supplies transcription only; full voice conversation, native-language speech and application streaming remain gated.

## V5-09 — practice dictation slice

English practice now includes **Speak response** above the composer: one remembered browser approval, inline recording/Stop, automatic transcription into the existing response box, then explicit Send response. Cancellation preserves drafts and Voice settings revokes future capture approval. Short-lived owner/path-bound receipts protect voice provenance; normal atomic turn admission, retries, forks and evaluation apply. Live Meta transcription plus character-response persistence passed on a synthetic fixture. See [dictation acceptance](V5_09_DICTATION.md). This is partial V5-09: speaking 2D avatar, automatic readback, streaming and complete human voice-room acceptance remain pending.

October 30, 2026: the user accepted all four V5-09 inline dictation checks on localhost (record/Stop, edit/send, remembered approval, Cancel/draft preservation). Full voice conversation remains pending.

## V5-09 update — spoken AI replies and native speech preview

October 30, 2026: implemented opt-in automatic device-local spoken replies, Stop/Replay and microphone interruption; Hindi/Telugu inline dictation and locale-bound provenance are available under localhost language acceptance preview. Live Meta public read-speech fixtures returned Hindi/Telugu scripts, with recognition differences recorded. Human microphone, fluent review and audible acceptance for the new three-language flow are pending; the user offered to arrange testing. See [spoken replies acceptance](V5_09_SPOKEN_REPLIES.md). This supersedes earlier statements that automatic readback is unimplemented; the 2D avatar, streaming and production voice release remain pending.

October 30, 2026 playback acceptance update: Hindi and Telugu Auto speak replies and Replay passed by user report. Native microphone/transcription and recording-interruption results remain pending. See V5_09_SPOKEN_REPLIES.md.

October 30, 2026 dictation acceptance update: the user also confirmed the Hindi/Telugu Speak response → Stop → edit → Send flow working. Native dictation/reviewed submission are user-reported passes; microphone interruption of active AI playback remains awaiting explicit human confirmation.

October 30, 2026 interruption acceptance update: the user confirmed that starting recording stops Priya’s active playback. The requested localhost Hindi/Telugu playback, Replay, reviewed dictation and interruption checks are now accepted by user report. No separate locale/device breakdown was supplied for interruption. Production release and fluent translation-content approval remain separate.

## V5-09 — speaking 2D character implemented locally

October 30, 2026: added illustrated Priya with portrait fallback, actual playback-start/stop-driven approximate motion, full-reply captions, ordered capture/transcription/thinking/preparation/speaking states, reduced motion and responsive layout. The renderer cannot modify simulation state. The local V5-09 implementation is complete; prior user audio acceptance is preserved, while human visual review of the new renderer is not yet reported. See [2D character acceptance](V5_09_2D_CHARACTER.md). Streaming/full-duplex, native translation release review and AWS deployment remain separate.

October 30, 2026 Telugu voice availability fix: Geeta and Enhanced are installed. Added a development-loopback macOS fallback for browsers whose Web Speech voice catalog omits Telugu, with owned saved-reply-only WAV generation, transient-file cleanup and existing playback/character cancellation. Real Geeta synthesis and HTMLAudio playback checks passed; no new human hearing result is claimed. See [local Mac voice fallback](V5_09_LOCAL_MAC_VOICE.md).

October 30, 2026 visual direction update: user requires photorealistic live characters and Meta Muse Realtime Avatar only. The cartoon is removed and the photo-based practice layout is delivered locally. Actual photo lip-sync is pending official developer/preview API access, not complete. Existing local audio/transcription behavior remains available.
