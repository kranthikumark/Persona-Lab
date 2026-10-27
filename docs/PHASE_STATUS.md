# PERSONA LAB — Actual implementation status

Updated October 27, 2026. This is local evidence, not public-release acceptance.

## Phase progress

| Phase                      | Status                      | Delivered / remaining                                                                                                                                                                                                                                                               |
| -------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Foundation             | Local foundation delivered  | Dedicated Git repository and origin, Next.js/TypeScript tooling, PostgreSQL role/database, Prisma migration, seed, mock and documented Meta adapters. Live Meta key and one structured application turn verified; broader live acceptance pending.                                  |
| 1 — Design system          | Complete                    | Cohesive studio/practice/comparison, documented tokens, active navigation, mobile context disclosure, vertical timeline, shared-history split, branch selectors, keyboard focus/return, reduced motion, and honest loading/error/empty states. Acceptance: `PHASE_1_ACCEPTANCE.md`. |
| 2 — Persisted conversation | Verified in mock mode       | Five turns, reload/resume, ownership checks, local drafts, deletion, scoped access, and handled errors. One live structured turn and reload verified; five-turn/fork live acceptance remains pending.                                                                               |
| 3 — State/timeline         | Core implemented and tested | Bounded transitions, guarantee phrase checks, ordered events, atomic snapshots, idempotency, optimistic concurrency, explicit knowledge-reveal rules. Rules are a limited training implementation.                                                                                  |
| 4 — Branching/comparison   | Core implemented and tested | Exact saved-state fork, stable prefix message IDs, nonzero/nested fork restoration, parent isolation, branch switching, transcripts, final indicators, event counts. Rich event-by-event difference presentation remains.                                                           |
| 5 — Evaluation             | Limited early feedback only | Deterministic guarantee findings reference actual messages. Full five-category rubric, persisted evaluation reports, and optional supplemental judging are not implemented.                                                                                                         |
| 6 — Polish/accessibility   | Started                     | Desktop visual review, responsive layouts, focus styles, Radix focus management, reduced-motion rules, mobile overflow check, draft/error states. Full keyboard/screen-reader/contrast/device acceptance remains.                                                                   |
| 7 — Deployment/release     | Local checks only           | Local build/tests and setup documentation. No public hosting, full live-provider acceptance, production rate limiting, or automated expiry purge yet.                                                                                                                               |
| 8 — Demo/submission        | Not started                 | No demonstration video or organizer submission.                                                                                                                                                                                                                                     |

## Verification performed

- `npm install --no-audit --no-fund`: dependencies installed successfully.
- `npm run db:setup`: dedicated local role/database created; generated credentials saved privately without printing them.
- `npm run db:migrate`: initial migration applied successfully to native PostgreSQL 15.17.
- `npm run db:seed`: fictional scenario seeded successfully; seed is idempotent.
- `npm run lint`: passed with no errors or warnings.
- `npm run typecheck`: passed.
- `npm test`: 11 unit tests passed (domain invariants and provider boundaries).
- `npm run test:integration`: 3 PostgreSQL tests passed (provider-failure consistency, transaction rollback, nonzero/nested forks).
- `npm run test:e2e`: 6 Playwright tests passed on isolated mock port 3101: 3 existing journey/API checks and 3 Phase 1 design/accessibility checks. Earlier journey checks also passed against the local production build.
- Phase 1: 9 axe scans passed with no violations under the selected WCAG 2 A/AA and 2.1 AA rules across desktop/mobile screens and open drawers. This is not full accessibility certification.
- Six browser captures at 1440 × 1000 and 390 × 844 were reviewed; see `PHASE_1_ACCEPTANCE.md`.
- `npm run build`: passed after the final source changes.
- Production client-bundle scan: no matches for the private budget/history text, `privateKnowledge`, or `META_API_KEY` in `.next/static/chunks`.
- `npx prisma migrate status`: database schema is up to date.
- The local production server is available at `http://127.0.0.1:3100` in Meta mode after a successful live smoke test.
- `.env` is Git-ignored with filesystem permissions `0600`.

The first seed attempt exposed ESM configuration and environment-loading issues; both were corrected and the seed rerun successfully. Early lint findings were corrected before the final passing run. A desktop composer-position issue was corrected and covered by an in-viewport assertion. A shared scenario-module boundary was split so private character facts stay in server-only code.

## Current constraints

- The local app now uses `AI_PROVIDER=meta`. Mock mode remains available for deterministic development and tests.
- A direct Meta request and one application-adapter turn returned HTTP 200 from Muse Spark 1.3; reload preserved the saved conversation. Broader live acceptance remains pending.
- Character budget/history facts are available to the model only after explicit reveal rules. Public client components import a separate public scenario definition.
- Guarantee detection uses a narrow transparent phrase heuristic. No claim of exhaustive accuracy, psychological measurement, real-world prediction, or proven causality is made.
- Session access expires after 30 days; automated physical purging is pending. Clearing the browser ownership cookie loses access.
- Demo session/branch/turn limits are basic local controls. Public release needs distributed rate limiting and transactionally enforced creation quotas.
- Prisma 6 emits a configuration deprecation notice. It is pinned and working; a future major upgrade needs a deliberate configuration migration.

## Next implementation increment

1. Extend the successful live Meta smoke test to five turns, knowledge boundaries, forks, comparison, and failure behavior.
2. Implement explicit, versioned scoring rules for the five rubric categories, with insufficient-evidence states and actual message/event references.
3. Persist evaluation revision/scope, improve event/state differences, and add related domain and browser tests.
4. Complete accessibility/device QA, production abuse controls, expiry cleanup, and managed deployment acceptance.

## Visual evidence and assets

- `docs/screenshots/studio-desktop.png`: initial local studio screenshot.
- `docs/screenshots/phase-1/`: reviewed desktop/mobile studio, practice, and comparison captures (labelled mock mode).
- `public/images/priya.webp`: original fictional portrait generated with the built-in image tool; prompt/provenance in `docs/ASSETS.md`.

The software is MIT-licensed. Git delivery status is reported in the final handoff; a local commit does not prove a push or deployment.
