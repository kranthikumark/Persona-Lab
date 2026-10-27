# PERSONA LAB — Actual implementation status

Updated October 27, 2026. This is local evidence, not public-release acceptance.

## Phase progress

| Phase                      | Status                      | Delivered / remaining                                                                                                                                                                                                                                                                     |
| -------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundation             | Local foundation delivered  | Dedicated Git repository and origin, Next.js/TypeScript tooling, PostgreSQL role/database, Prisma migration, seed, mock and documented Meta adapters. Live Meta access and Phase 2 conversation acceptance verified locally.                                                              |
| 1 — Design system          | Complete                    | Cohesive studio/practice/comparison, documented tokens, active navigation, mobile context disclosure, vertical timeline, shared-history split, branch selectors, keyboard focus/return, reduced motion, and honest loading/error/empty states. Acceptance: `PHASE_1_ACCEPTANCE.md`.       |
| 2 — Persisted conversation | Complete locally with Meta  | Five live turns, exact reload/resume, sixth turn, access isolation, draft recovery and genuine provider failure without partial writes. Acceptance: `PHASE_2_ACCEPTANCE.md`.                                                                                                              |
| 3 — State/timeline         | Complete locally            | Bounded state, resolving evidence, exact saved-state previews, forced overlapping retries/stale writes, late-write rollback, and knowledge-boundary checks passed. Rule matching corrected. Acceptance: `PHASE_3_ACCEPTANCE.md`.                                                          |
| 4 — Branching/comparison   | Core implemented and tested | Exact saved-state fork, stable prefix message IDs, nonzero/nested fork restoration, parent isolation, branch switching, transcripts, final indicators, event counts. Live fork/comparison smoke passed; formal Phase 4 acceptance and rich event-by-event difference presentation remain. |
| 5 — Evaluation             | Limited early feedback only | Deterministic guarantee findings reference actual messages. Full five-category rubric, persisted evaluation reports, and optional supplemental judging are not implemented.                                                                                                               |
| 6 — Polish/accessibility   | Started                     | Desktop visual review, responsive layouts, focus styles, Radix focus management, reduced-motion rules, mobile overflow check, draft/error states. Full keyboard/screen-reader/contrast/device acceptance remains.                                                                         |
| 7 — Deployment/release     | Local checks only           | Local build/tests and setup documentation. No public hosting, deployed live-provider acceptance, production rate limiting, or automated expiry purge yet.                                                                                                                                 |
| 8 — Demo/submission        | Not started                 | No demonstration video or organizer submission.                                                                                                                                                                                                                                           |

## Verification performed

- `npm install --no-audit --no-fund`: dependencies installed successfully.
- `npm run db:setup`: dedicated local role/database created; generated credentials saved privately without printing them.
- `npm run db:migrate`: initial migration applied successfully to native PostgreSQL 15.17.
- `npm run db:seed`: fictional scenario seeded successfully; seed is idempotent.
- `npm run lint`: passed with no errors or warnings.
- `npm run typecheck`: passed.
- `npm test`: 22 unit tests passed (domain invariants, bounded repeated transitions, phase/guarantee regression cases, and provider boundaries).
- `npm run test:integration`: 9 PostgreSQL tests passed, including forced overlapping same-key/different-key requests, stale writes, exact state/evidence records, late snapshot-write rollback, and nonzero/nested forks.
- `npm run test:e2e`: 7 Playwright tests passed on isolated mock port 3101 in 24.8 seconds: 3 journey/API checks, 3 Phase 1 design/accessibility checks, and the Phase 3 timeline/saved-state browser check.
- `PERSONA_LIVE_VERIFY=1 npm run verify:live`: 2 live browser tests passed in 47.5 seconds, with seven successful Meta generations and one genuine invalid-credential failure. Test sessions were deleted; the temporary failure server was stopped. See `PHASE_2_ACCEPTANCE.md`.
- Phase 1: 9 axe scans passed with no violations under the selected WCAG 2 A/AA and 2.1 AA rules across desktop/mobile screens and open drawers. This is not full accessibility certification.
- Six browser captures at 1440 × 1000 and 390 × 844 were reviewed; see `PHASE_1_ACCEPTANCE.md`.
- `npm run build`: passed after the final source changes.
- Production client-bundle scan after the Phase 3 build: no matches for the actual private key/database URL, private budget/history instructions, `privateKnowledge`, or `META_API_KEY` across 13 JavaScript chunks in `.next/static/chunks`.
- `npx prisma migrate status`: database schema is up to date.
- The updated local production server was restarted at `http://127.0.0.1:3100` after Phase 3 and returned HTTP 200 in Meta mode. Phase 2 live-generation evidence is recorded separately; Phase 3 used mock generation.
- `.env` is Git-ignored with filesystem permissions `0600`.

The first seed attempt exposed ESM configuration and environment-loading issues; both were corrected and the seed rerun successfully. Early lint findings were corrected before the final passing run. A desktop composer-position issue was corrected and covered by an in-viewport assertion. A shared scenario-module boundary was split so private character facts stay in server-only code.

## Current constraints

- The local app now uses `AI_PROVIDER=meta`. Mock mode remains available for deterministic development and tests.
- Seven generated responses were verified as Meta Muse Spark 1.3, including a resumed sixth turn and an independent alternative. Genuine upstream 401 handling passed on an isolated server. These checks establish local acceptance for the tested scenario, not public deployment.
- Character budget/history facts are available to the model only after explicit reveal rules. Public client components import a separate public scenario definition.
- Saved scenario context versions do not select historical executable reducers; old snapshots are replayed as stored, while new turns use the current code.
- Guarantee detection uses a narrow transparent phrase heuristic. No claim of exhaustive accuracy, psychological measurement, real-world prediction, or proven causality is made.
- Session access expires after 30 days; automated physical purging is pending. Clearing the browser ownership cookie loses access.
- Demo session/branch/turn limits are basic local controls. Public release needs distributed rate limiting and transactionally enforced creation quotas.
- Prisma 6 emits a configuration deprecation notice. It is pinned and working; a future major upgrade needs a deliberate configuration migration.

## Next implementation increment

1. Complete Phase 4 acceptance and improve event/state differences.
2. Implement Phase 5 versioned scoring and persisted evaluation scope, with insufficient-evidence states and actual message/event references.
3. Complete accessibility/device QA, production abuse controls, expiry cleanup, and managed deployment acceptance.

## Visual evidence and assets

- `docs/screenshots/studio-desktop.png`: initial local studio screenshot.
- `docs/screenshots/phase-3/`: reviewed saved-state preview; structured timeline evidence in `docs/verification/phase-3/`.
- `docs/screenshots/phase-2/`: live conversation, comparison, and retained draft captures; structured evidence in `docs/verification/phase-2/`.
- `docs/screenshots/phase-1/`: reviewed desktop/mobile studio, practice, and comparison captures (labelled mock mode).
- `public/images/priya.webp`: original fictional portrait generated with the built-in image tool; prompt/provenance in `docs/ASSETS.md`.

The software is MIT-licensed. Git delivery status is reported in the final handoff; a local commit does not prove a push or deployment.
