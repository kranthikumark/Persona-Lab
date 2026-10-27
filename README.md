# PERSONA LAB

**Practice Decisions. Explore Consequences. Master Reality.**

A text-first decision practice studio. Meet Priya, a fictional insurance customer, practice an honest conversation, return to a saved decision, and compare another simulated path.

## Current implementation

- Dark scenario studio, practice workspace, original AI-generated fictional portrait, responsive layout, keyboard-accessible drawers, and locally bundled fonts.
- PostgreSQL-backed sessions, ordered messages/events, saved state, browser-scoped access, 30-day session expiry, draft recovery, and session deletion.
- Server-validated bounded state, transactional turn writes, optimistic concurrency, and idempotent turn retries.
- Fork from a saved pre-decision snapshot, preserve shared message IDs, and keep parent and child turns independent.
- Side-by-side transcripts, shared-history findings, per-turn recorded state/event changes, and guarantee-phrase feedback linked to stored messages.
- Explicit deterministic mock adapter and a server-only Meta Muse Spark adapter built against official documentation.

**Phase 2 live Meta acceptance complete locally:** five turns, exact reload/resume, a sixth turn, scoped access, and provider-failure recovery passed. An independent live alternative and comparison also passed. The checked-in template defaults to mock mode; the current private local configuration uses Meta. Production controls, public deployment, and submission are still pending. See [phase status](docs/PHASE_STATUS.md).

**Phase 3 state/timeline acceptance complete locally:** 38 routine checks pass, including forced concurrent writes, rollback, bounded state, knowledge isolation, evidence references, and saved-state previews. See [Phase 3 acceptance](docs/PHASE_3_ACCEPTANCE.md).

**Phase 4 branching/comparison acceptance complete locally:** independent parent/sibling/nested paths, shared versus divergent evidence, per-turn recorded state changes, and desktop/mobile replay and resumption. See [Phase 4 acceptance](docs/PHASE_4_ACCEPTANCE.md).

**Phase 5 evaluation complete locally:** versioned five-category reports, exact evidence, strengths/next actions, explicit insufficient evidence, saved revision scope and outdated-report notices. Open Field notes in practice or Rubric evaluation in comparison. See [Phase 5 acceptance](docs/PHASE_5_ACCEPTANCE.md).

**Phase 7 localhost release checks:** shared usage admission, atomic creation quotas and expiry cleanup implemented; 47 unit, 26 integration and 19 mock browser checks plus a seven-generation live Meta journey passed. AWS Ubuntu deployment is pending local review. See [local release results and AWS handoff](docs/PHASE_7_LOCAL_RELEASE.md).

**Phase 6 visual upgrade and local acceptance:** portrait-led studio, editorial workspace headings, prominent evaluation, repaired evidence focus, 320px reflow, larger-text and forced-colors checks. Native zoom, audible screen-reader and physical-device release checks remain open. See [Phase 6 acceptance](docs/PHASE_6_ACCEPTANCE.md).

## Local setup

Requires Node.js 22+ (verified with 24.22.1), npm, native PostgreSQL, and `psql` for the optional local database helper. No Docker is required.

```bash
npm ci
npm run db:setup
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3100. The database helper creates a dedicated `persona_lab` role/database and a mode-0600 ignored `.env`, without printing its generated password. It refuses to overwrite an existing `.env`. It assumes the current operating-system user can create a PostgreSQL role and database. If that is unavailable, create a database yourself and copy `.env.example` to `.env`, supplying its connection string.

Keep `.env` private. Never put credentials in chat or source control. The app uses `AI_PROVIDER=mock` by default. To configure Meta, set `AI_PROVIDER=meta`, `META_API_KEY`, and optionally `META_MODEL` in `.env`, then restart. See [Meta integration](docs/META_INTEGRATION.md).

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
```

Persistence integration and end-to-end tests use the local database and create fictional test sessions. One API test deletes only the session it creates; browser journey sessions remain visible only to their isolated browser contexts. Locally, Playwright uses installed Google Chrome to avoid downloading another browser. In CI, run `npx playwright install --with-deps chromium` before testing. Browser tests start an isolated mock development server on 3101, using `.next-dev`; they do not reuse or change the Meta application running on 3100.

For production use `npm run build` and `npm start`, and set `APP_ORIGIN` to the exact HTTPS origin. Production cookies use `Secure`. The localhost development origin is deliberately `http://127.0.0.1:3100`; using another origin requires matching `APP_ORIGIN`.

Live checks are separate and opt-in because they make real provider requests: `PERSONA_LIVE_VERIFY=1 npm run verify:live`. They require the Meta application on 3100 and an isolated invalid-credential server on 3102. Setup, evidence, and cleanup are documented in [Phase 2 acceptance](docs/PHASE_2_ACCEPTANCE.md). Routine tests stay in mock mode.

## Architecture and consistency

Next.js App Router + React + TypeScript + Tailwind, shadcn-style Radix/CVA primitives, Lucide, Prisma 6, PostgreSQL, and Zod. Prisma is pinned to a stable 6.x version for its schema-based datasource configuration; do not upgrade across major versions without migrating configuration.

A session pins its scenario JSON. Each branch owns new messages, events, snapshots, and idempotency records. A child references its parent and immutable fork snapshot. Reading a child resolves the parent's prefix up to that boundary, then appends child records. Shared records retain IDs for evidence.

The provider runs outside a database transaction. Before committing, a revision-checked update claims the branch's next turn. User/character messages, event, snapshot, and idempotency record then commit in one transaction. A losing concurrent request returns 409; provider failure saves nothing. Concurrent duplicate calls may perform redundant provider work, but only one turn commits.

Private personal knowledge is withheld from model input until explicit rules reveal it. Public session DTOs omit private scenario data, owner hashes, raw provider responses, and snapshot knowledge. Access is bound to a random HttpOnly SameSite cookie whose hash is stored as session ownership. Clearing that cookie loses access; there is no account recovery in this version.

## Limits and interpretation

All policy facts and people are fictional. Outcomes are model-generated possibilities, not predictions of human behavior or causal effects. Visible confidence indicators are simulation variables. The deterministic guarantee check recognizes a narrow set of phrases; absence of a flag does not prove compliance or factual accuracy. The five-category rubric uses ten versioned phrase checks with actual message/event evidence. Missing checks remain unscored; results are limited rule coverage rather than a complete quality assessment. See [evaluation rules](docs/EVALUATION_RULES.md).

Session access expires after 30 days. `npm run db:purge` physically deletes a bounded batch of expired aggregates; deployment must schedule and monitor it. Explicit deletion remains available in history. PostgreSQL-backed generation/creation admission and transactional session/branch quotas are implemented; browser ownership can be reset, so AWS edge abuse controls and deployed acceptance remain pending. See [Phase 7 localhost-to-AWS handoff](docs/PHASE_7_LOCAL_RELEASE.md).

## Assets

`public/images/priya.webp` is an original fictional portrait generated using the built-in image generation tool. Its prompt and provenance are documented in [assets](docs/ASSETS.md). Reference screenshots are design inspiration only and are not shipped. Fonts are bundled locally through Fontsource packages with their included licenses.

## Project documentation

- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Phase 1 acceptance and screenshots](docs/PHASE_1_ACCEPTANCE.md)
- [Phase 2 live acceptance and evidence](docs/PHASE_2_ACCEPTANCE.md)
- [Phase 3 state and timeline acceptance](docs/PHASE_3_ACCEPTANCE.md)
- [Phase 4 branching and comparison acceptance](docs/PHASE_4_ACCEPTANCE.md)
- [Phase 5 evaluation acceptance](docs/PHASE_5_ACCEPTANCE.md)
- [Evaluation scoring rules](docs/EVALUATION_RULES.md)
- [Phase 6 visual/accessibility acceptance](docs/PHASE_6_ACCEPTANCE.md)
- [Actual phase status](docs/PHASE_STATUS.md)
- [Meta adapter documentation](docs/META_INTEGRATION.md)

Software is provided under the [MIT license](LICENSE). Current Git delivery is reported in the handoff. The application has not been publicly deployed.
