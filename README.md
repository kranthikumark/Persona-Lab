# PERSONA LAB

**Practice Decisions. Explore Consequences. Master Reality.**

A text-first decision practice studio. Meet Priya, a fictional insurance customer, practice an honest conversation, return to a saved decision, and compare another simulated path.

## Current implementation

- Light and dark scenario studio, practice workspace, original AI-generated fictional portrait, responsive layout, keyboard-accessible drawers, and locally bundled fonts. Use the sun/moon toggle in the top bar to change themes; the browser remembers your choice. Dark is the default.
- PostgreSQL-backed sessions, ordered messages/events, saved state, browser-scoped access, 30-day session expiry, draft recovery, and session deletion.
- Server-validated bounded state, transactional turn writes, optimistic concurrency, and idempotent turn retries.
- Fork from a saved pre-decision snapshot, preserve shared message IDs, and keep parent and child turns independent.
- Side-by-side transcripts, shared-history findings, per-turn recorded state/event changes, and guarantee-phrase feedback linked to stored messages.
- Explicit deterministic mock adapter and a server-only Meta Muse Spark adapter built against official documentation.

**Phase 2 live Meta acceptance complete locally:** five turns, exact reload/resume, a sixth turn, scoped access, and provider-failure recovery passed. An independent live alternative and comparison also passed. The checked-in template defaults to mock mode; the current private local configuration uses Meta. Production controls, public deployment, and submission are still pending. See [phase status](docs/PHASE_STATUS.md).

**Phase 3 state/timeline acceptance complete locally:** 38 routine checks pass, including forced concurrent writes, rollback, bounded state, knowledge isolation, evidence references, and saved-state previews. See [Phase 3 acceptance](docs/PHASE_3_ACCEPTANCE.md).

**Phase 4 branching/comparison acceptance complete locally:** independent parent/sibling/nested paths, shared versus divergent evidence, per-turn recorded state changes, and desktop/mobile replay and resumption. See [Phase 4 acceptance](docs/PHASE_4_ACCEPTANCE.md).

**Phase 5 evaluation complete locally:** versioned five-category reports, exact evidence, strengths/next actions, explicit insufficient evidence, saved revision scope and outdated-report notices. Open Field notes in practice or Rubric evaluation in comparison. See [Phase 5 acceptance](docs/PHASE_5_ACCEPTANCE.md).

**October 28 acceptance follow-up:** page titles and composer/dialog focus repaired; eight checks pass in each of Chrome, Firefox and WebKit. The user subsequently reported VoiceOver, native zoom, physical-phone and sharing checks working; device details and separate comprehension timing were not supplied. See [manual review checklist](docs/PHASE_6_MANUAL_REVIEW.md).

**Phase 7 localhost release checks:** shared usage admission, atomic creation quotas and expiry cleanup implemented; 47 unit, 26 integration and 19 mock browser checks plus a seven-generation live Meta journey passed. AWS Ubuntu deployment is pending local review. See [local release results and AWS handoff](docs/PHASE_7_LOCAL_RELEASE.md).

**Phase 6 visual upgrade and local acceptance:** portrait-led studio, editorial workspace headings, prominent evaluation, repaired evidence focus, 320px reflow, larger-text and forced-colors checks. The user subsequently reported native zoom, VoiceOver and physical-phone checks working; see the manual review record for the limits of that confirmation. See [Phase 6 acceptance](docs/PHASE_6_ACCEPTANCE.md).

**Session report cards:** every session receives a score, evidence-linked positives, observed concerns and practical improvements when Field notes opens. Partial evidence is labeled provisional; historical reports are preserved. See [scoring and report behavior](docs/REPORT_CARD.md).

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

For Hindi/Telugu text practice on localhost, stop the existing server and run `npm run dev:locales`. This enables the labeled acceptance preview until you stop that process. Restart with the same command to keep the selectors available. Interface and coaching remain English; native-language review is pending; Indic exports are available for local acceptance. Normal `npm run dev` keeps those languages gated, and production cannot enable this preview.

The chat’s **Type in Hindi/Telugu** helper links to the official Google Input Tools Chrome extension and online typing tool. Extension setup is manual; the in-app browser can use the online copy-and-paste option or a device keyboard. Persona Lab does not load Google typing scripts or automatically transmit drafts to Google. IME composition remains protected from accidental Enter-to-send.

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

For production use `npm run build` and `npm start`, and set `APP_ORIGIN` to the exact HTTPS origin. Production cookies use `Secure`. Local development defaults to `http://127.0.0.1:3100` and also accepts `localhost` or IPv6 loopback on the same protocol and port. Other development addresses, including a phone's LAN review address, require matching `APP_ORIGIN`. Production always requires the exact configured origin.

Live checks are separate and opt-in because they make real provider requests: `PERSONA_LIVE_VERIFY=1 npm run verify:live`. They require the Meta application on 3100 and an isolated invalid-credential server on 3102. Setup, evidence, and cleanup are documented in [Phase 2 acceptance](docs/PHASE_2_ACCEPTANCE.md). Routine tests stay in mock mode.

## Architecture and consistency

Next.js App Router + React + TypeScript + Tailwind, shadcn-style Radix/CVA primitives, Lucide, Prisma 6, PostgreSQL, and Zod. Prisma is pinned to a stable 6.x version for its schema-based datasource configuration; do not upgrade across major versions without migrating configuration.

A session pins its scenario JSON. Each branch owns new messages, events, snapshots, and idempotency records. A child references its parent and immutable fork snapshot. Reading a child resolves the parent's prefix up to that boundary, then appends child records. Shared records retain IDs for evidence.

The provider runs outside a database transaction. Before committing, a revision-checked update claims the branch's next turn. User/character messages, event, snapshot, and idempotency record then commit in one transaction. A losing concurrent request returns 409; provider failure saves nothing. Concurrent duplicate calls may perform redundant provider work, but only one turn commits.

Private personal knowledge is withheld from model input until explicit rules reveal it. Public session DTOs omit private scenario data, owner hashes, raw provider responses, and snapshot knowledge. Access is bound to a random HttpOnly SameSite cookie whose hash is stored as session ownership. Clearing that cookie loses access; there is no account recovery in this version.

## Limits and interpretation

All policy facts and people are fictional. Outcomes are model-generated possibilities, not predictions of human behavior or causal effects. Visible confidence indicators are simulation variables. The deterministic guarantee check recognizes a narrow set of phrases; absence of a flag does not prove compliance or factual accuracy. The five-category rubric uses ten versioned phrase checks with actual message/event evidence. Every practice report now displays a numeric rubric score; missing evidence earns no points, with coverage and limitations shown separately. Results are limited rule coverage rather than a complete quality assessment. See [report cards](docs/REPORT_CARD.md). See [evaluation rules](docs/EVALUATION_RULES.md).

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

**V5-01:** baseline preservation, verified isolated database restore, frozen regression fixtures and fail-closed capability gates. See [V5-01 evidence](docs/V5_01_BASELINE.md) and the [V5 plan](docs/V5_IMPLEMENTATION_PLAN.md).

**V5-02:** new responses require 1–70 words; v3 evaluates nine quality checks with length shown separately. Existing reports and committed historical retries are preserved. See [V5-02 acceptance](docs/V5_02_ACCEPTANCE.md).

**V5-03:** new practices use versioned milestone progression and branch-specific answered-topic context. Existing sessions keep their saved rules and show a legacy notice. Five real Meta turns passed locally. See [V5-03 acceptance](docs/V5_03_ACCEPTANCE.md).

**V5-04:** additive locale/modality metadata, immutable English baseline, pinned practice/branch settings, original message provenance and browser-owned preferences. Existing history and report JSON are preserved. Language selectors and Hindi/Telugu practice remain V5-05 work. See [V5-04 acceptance](docs/V5_04_ACCEPTANCE.md).

**V5-05 implementation and live checks:** language selection, Hindi/Telugu drafts, native rule adapters, original-script histories and local UI fonts are implemented and verified in acceptance preview. English remains enabled normally. Native-speaker review and V5-06 Indic export acceptance are still pending. See [V5-05 evidence](docs/V5_05_ACCEPTANCE.md) and [translation review packet](docs/reviews/V5_05_TRANSLATIONS.md).

**V5-06 local verification:** corrected versioned native evaluation, draft Hindi/Telugu coaching companions, original-script PDF/Word and sharing summaries. Refresh older native cards for the corrected report; originals are retained. `npm run verify:reports:indic` creates synthetic review samples. Indic PDF needs server Chromium (`PERSONA_PDF_BROWSER_PATH` on Linux). Fluent-speaker and target-reader acceptance remain pending. See [V5-06 acceptance](docs/V5_06_ACCEPTANCE.md).

### Scenario library and private text drafts (V5-07)

Use the home-page library filters, or open `/create` to author a private English insurance brief from the verified Priya template. Facts, character and scoring remain tied to its tested runtime. Draft editing never grants publication permission; a named local OS operator must inspect and approve the saved revision. See [V5-07 acceptance and operator commands](docs/V5_07_ACCEPTANCE.md). Personal and native-language authoring remain unavailable. `npm run test:catalog` runs publication acceptance in a disposable local database.

### English speech in practice

Run `npm run dev`, open English practice, and click **Speak response** above the response box. The first approval is remembered in your browser. Speak → **Stop recording** → text is automatically added to your draft → edit → **Send response**. Recording controls stay inline; existing draft text is kept. Use **Voice settings** to turn off the remembered approval. No audio files are retained by this application.

The V5-08 diagnostic room remains at `/sessions/SESSION_ID/speech-check` for isolated device checks. Normal practice uses the inline control instead. See [practice dictation](docs/V5_09_DICTATION.md); complete character speech/animation remains subsequent V5-09 work.

`npm run test:speech` uses synthetic browser audio and mocked transcription/playback. `verify:speech:live` requires an explicitly selected WAV and processing-consent argument. On a constrained workstation, `PERSONA_LOW_DISK_BUILD=1 npm run build` disables optional persistent build-cache writes; standard production cache behavior is unchanged.

### Spoken replies and Hindi/Telugu voice preview

Run `npm run dev:locales` for the localhost language acceptance preview. Select a language before starting a new practice. **Auto speak replies** enables matching installed-device playback; **Stop reply** and **Replay reply** stay inline. Beginning recording stops playback. If a matching voice is missing, install it in device settings; text and dictation remain available. Hindi/Telugu live ASR sample checks passed with recognition differences; human three-language listening/microphone acceptance is pending. See [current voice acceptance](docs/V5_09_SPOKEN_REPLIES.md).

### Priya’s photographic practice view

Practice uses Priya’s photograph in a larger stage with full-reply captions and Listening/Transcribing/Thinking/Speaking activity. The image is static; there is no simulated facial motion. Enable video avatar starts the configured Simli face, driven by saved reply audio. See [Simli preview setup and acceptance](docs/V5_09_SIMLI.md).

### Installed Telugu voice not visible to the browser

On localhost macOS, practice can use installed Geeta/Geeta Enhanced through local WAV playback when the browser does not expose a Telugu Web Speech voice. Refresh practice; Auto speak and Replay use the fallback automatically. It generates only saved AI replies, removes temporary generated files, and makes no cloud TTS request. This development-only Mac fallback is unavailable on AWS Ubuntu. See [local Mac voice verification](docs/V5_09_LOCAL_MAC_VOICE.md).

### Simli live video preview

The user-selected Simli key and face ID stay in the ignored server environment. On localhost macOS, run `npm run dev:locales`, open practice and click **Enable video avatar**. Then use **Replay reply** or **Auto speak replies** and send a response. The configured face renders reply audio as synchronized video; Meta still creates the saved conversation and handles dictation. Video is an explicit two-minute preview with bounded admissions; ending video restores the portrait and device speech. The current PCM speech source requires installed Mac voices and is not yet available on AWS Ubuntu. See [setup, verification and remaining acceptance](docs/V5_09_SIMLI.md).

### Private audio/video reference sources (V5-10)

Open `/create` through **Create a scenario**. Save a private WAV/MP3/M4A/MP4/WebM source (0.25–60 seconds, up to 20 MiB), choose 1-day or 7-day retention, then explicitly transcribe its audio with Meta or enter the words yourself. Review and attach the transcript before operator publication. Source files are held in the private local `.private-media/` store; delete controls remove the raw source and all transcript versions. `npm run db:purge` handles expiry and interrupted deletion. See [setup and verification](docs/V5_10_ACCEPTANCE.md).
