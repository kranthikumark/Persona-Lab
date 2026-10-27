# PERSONA LAB — Actual implementation status

Updated October 27, 2026. This is local evidence, not public-release acceptance.

## Phase progress

| Phase                      | Status                     | Delivered / remaining                                                                                                                                                                                                                                                               |
| -------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundation             | Local foundation delivered | Dedicated Git repository and origin, Next.js/TypeScript tooling, PostgreSQL role/database, Prisma migration, seed, mock and documented Meta adapters. Live Meta access and Phase 2 conversation acceptance verified locally.                                                        |
| 1 — Design system          | Complete                   | Cohesive studio/practice/comparison, documented tokens, active navigation, mobile context disclosure, vertical timeline, shared-history split, branch selectors, keyboard focus/return, reduced motion, and honest loading/error/empty states. Acceptance: `PHASE_1_ACCEPTANCE.md`. |
| 2 — Persisted conversation | Complete locally with Meta | Five live turns, exact reload/resume, sixth turn, access isolation, draft recovery and genuine provider failure without partial writes. Acceptance: `PHASE_2_ACCEPTANCE.md`.                                                                                                        |
| 3 — State/timeline         | Complete locally           | Bounded state, resolving evidence, exact saved-state previews, forced overlapping retries/stale writes, late-write rollback, and knowledge-boundary checks passed. Rule matching corrected. Acceptance: `PHASE_3_ACCEPTANCE.md`.                                                    |
| 4 — Branching/comparison   | Complete locally           | Exact saved-state/prefix restoration, independent parent/sibling/nested paths, access isolation, evidence links, per-turn recorded state changes, unequal-length notices, and responsive replay/resumption. Acceptance: `PHASE_4_ACCEPTANCE.md`.                                    |
| 5 — Evaluation             | Complete locally           | Versioned five-category phrase rubric, explicit insufficient evidence, message/event references, immutable revision-scoped reports, stale notices, inherited finding scope, strengths/next actions and comparison reports. Acceptance: `PHASE_5_ACCEPTANCE.md`.                     |
| 6 — Polish/accessibility   | Started                    | Desktop visual review, responsive layouts, focus styles, Radix focus management, reduced-motion rules, mobile overflow check, draft/error states. Full keyboard/screen-reader/contrast/device acceptance remains.                                                                   |
| 7 — Deployment/release     | Local checks only          | Local build/tests and setup documentation. No public hosting, deployed live-provider acceptance, production rate limiting, or automated expiry purge yet.                                                                                                                           |
| 8 — Demo/submission        | Not started                | No demonstration video or organizer submission.                                                                                                                                                                                                                                     |

## Verification performed

- `npm install --no-audit --no-fund`: dependencies installed successfully.
- `npm run db:setup`: dedicated local role/database created; generated credentials saved privately without printing them.
- `npm run db:migrate`: initial migration applied successfully to native PostgreSQL 15.17.
- `npm run db:seed`: fictional scenario seeded successfully; seed is idempotent.
- `npm run lint`: passed with no errors or warnings.
- `npm run typecheck`: passed.
- `npm test`: 40 unit tests passed, including exact rubric weights, insufficient evidence, guarantee/pressure concerns, appropriate refusal, and rejected altered evidence/scores.
- `npm run test:integration`: 18 PostgreSQL tests passed, including persisted/concurrent evaluations, immutable old reports, stale-read notices, a forced stale-persistence race, inherited scope, denied access, corrupted evidence rejection and pinned policy support. Earlier state/branch checks also pass.
- `npm run test:e2e`: 13 Playwright tests passed on isolated mock port 3101 in 36.5 seconds, including desktop/mobile report scoring, persisted scope, exact evidence links, stale/current revisions, strict API input/access checks and comparison report scope. Earlier journey/design/timeline checks also pass.
- `PERSONA_LIVE_VERIFY=1 npm run verify:live`: 2 live browser tests passed in 47.5 seconds, with seven successful Meta generations and one genuine invalid-credential failure. Test sessions were deleted; the temporary failure server was stopped. See `PHASE_2_ACCEPTANCE.md`.
- Phase 1: 9 axe scans passed with no violations under the selected WCAG 2 A/AA and 2.1 AA rules across desktop/mobile screens and open drawers. This is not full accessibility certification.
- Phase 5: two further selected-rule axe scans passed on the evaluated report drawer, with no horizontal overflow.
- Phase 4: two additional axe scans passed the selected WCAG rules on the expanded comparison screens; desktop/mobile captures were reviewed.
- Six browser captures at 1440 × 1000 and 390 × 844 were reviewed; see `PHASE_1_ACCEPTANCE.md`.
- `npm run build`: passed after the final source changes.
- Production client-bundle scan after the Phase 5 build: no matches for the actual private key/database URL, private budget/history instructions, `privateKnowledge`, or `META_API_KEY` across 13 JavaScript chunks in `.next/static/chunks`.
- Local production evaluation smoke: opening-only history stays unscored, saved report reloads, unauthorized read returns 404; the session/report were deleted. No model request. Evidence: `docs/verification/phase-5/production.json`.
- `npm run db:migrate`: evaluation revision uniqueness migration applied; `npx prisma migrate status` confirms both migrations are up to date.
- The updated local production server was restarted at `http://127.0.0.1:3100` after Phase 5 and returned HTTP 200 in Meta mode. Phase 2 live-generation evidence is recorded separately; Phases 3–5 used mock generation; evaluation makes no provider calls.
- `.env` is Git-ignored with filesystem permissions `0600`.

The first seed attempt exposed ESM configuration and environment-loading issues; both were corrected and the seed rerun successfully. Early lint findings were corrected before the final passing run. A desktop composer-position issue was corrected and covered by an in-viewport assertion. A shared scenario-module boundary was split so private character facts stay in server-only code.

## Current constraints

- The local app now uses `AI_PROVIDER=meta`. Mock mode remains available for deterministic development and tests.
- Seven generated responses were verified as Meta Muse Spark 1.3, including a resumed sixth turn and an independent alternative. Genuine upstream 401 handling passed on an isolated server. These checks establish local acceptance for the tested scenario, not public deployment.
- Character budget/history facts are available to the model only after explicit reveal rules. Public client components import a separate public scenario definition.
- Saved scenario context versions do not select historical executable reducers; old snapshots are replayed as stored, while new turns use the current code.
- Evaluation uses ten limited English phrase rules. Category/overall scores stay unscored until their evidence requirements are met; scored results represent rule coverage, not a complete skill/compliance assessment.
- Guarantee detection uses a narrow transparent phrase heuristic. No claim of exhaustive accuracy, psychological measurement, real-world prediction, or proven causality is made.
- Session access expires after 30 days; automated physical purging is pending. Clearing the browser ownership cookie loses access.
- Demo session/branch/turn limits are basic local controls. Public release needs distributed rate limiting and transactionally enforced creation quotas.
- Prisma 6 emits a configuration deprecation notice. It is pinned and working; a future major upgrade needs a deliberate configuration migration.

## Next implementation increment

1. Complete Phase 6 journey polish, keyboard/screen-reader/zoom/contrast and device acceptance.
2. Complete Phase 7 production abuse controls, expiry cleanup and managed deployment acceptance.
3. Prepare Phase 8 demo/submission artifacts after release acceptance.

## Visual evidence and assets

- `docs/screenshots/studio-desktop.png`: initial local studio screenshot.
- `docs/screenshots/phase-5/`: reviewed desktop/mobile evaluation captures; saved revision reports in `docs/verification/phase-5/`.
- `docs/screenshots/phase-4/`: reviewed desktop/mobile recorded comparisons; structured results in `docs/verification/phase-4/`.
- `docs/screenshots/phase-3/`: reviewed saved-state preview; structured timeline evidence in `docs/verification/phase-3/`.
- `docs/screenshots/phase-2/`: live conversation, comparison, and retained draft captures; structured evidence in `docs/verification/phase-2/`.
- `docs/screenshots/phase-1/`: reviewed desktop/mobile studio, practice, and comparison captures (labelled mock mode).
- `public/images/priya.webp`: original fictional portrait generated with the built-in image tool; prompt/provenance in `docs/ASSETS.md`.

The software is MIT-licensed. Git delivery status is reported in the final handoff; a local commit does not prove a push or deployment.
