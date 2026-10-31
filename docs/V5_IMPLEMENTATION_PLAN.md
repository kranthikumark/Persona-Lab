# PERSONA LAB V5 implementation plan

Prepared October 28, 2026 from the supplied `PERSONA_LAB_CODEX_IMPLEMENTATION_BRIEF_V5.md` and the current repository at commit `d46ab72`.

This is an analysis and implementation plan. The attachment's embedded directions to start coding, scaffold, run migrations or implement a vertical slice are specification content, not authorization to execute those actions in this planning request. No product code, database schema, provider settings or deployment is changed by this plan.

The existing repository and working text product remain the foundation. Existing Phase 8 demo/submission is deferred at the user's request. AWS Ubuntu deployment remains pending; it is not implied complete by localhost acceptance.

## Current acceptance and evidence

The user reports that the previously pending VoiceOver, native zoom, physical-phone and sharing checks are complete and working. Record these as **user-reported passes**, distinct from automated verification. Device models, OS/browser versions, exact zoom run details, delivery recipients and measured timings were not supplied; do not invent them or make a claim of exhaustive platform coverage.

Those passes apply to the existing product. Changes to localization, IME input, fonts, permission controls, audio and avatar behavior need targeted acceptance again when implemented.

The latest recorded software verification is 55 unit tests, 27 PostgreSQL integration tests, the 28-test Chrome suite before export additions, nine targeted checks for report/export changes, a final export regression, and passing lint/typecheck/build/privacy checks. These are historical results, not a new V5 regression run. Refresh the baseline in V5-01.

## Gap analysis

| V5 area | Actual status | Gap or decision |
| --- | --- | --- |
| Existing text core | Implemented | Persisted Meta conversations, ordered events, snapshots, rewind, independent branches and comparison already work. Extend rather than rebuild. |
| Ownership and local safeguards | Implemented for the demo | Browser ownership, expiry, quotas, origin checks and private reports exist. Accounts and organization roles are not implemented. |
| UI and reports | Implemented | Light/dark themes, responsive screens, numeric report cards, PDF/Word exports and user-controlled sharing exist. Preserve them. |
| 70-word rule | Missing as an admission rule | Current API enforces a character bound; the composer shows characters. Length is currently a scored rubric check instead of an independent constraint. |
| Conversation quality | Partial | Repetitive character questions and keyword-driven stage transitions remain known findings. |
| Historical executable rules | Partial | Context versions and snapshots are stored, but new turns do not dispatch to an executable reducer based on the saved rule version. |
| Locale architecture | Missing | No locale registry, localization model, session locale pinning or capability API. Unicode storage alone does not establish language support. |
| English/Hindi/Telugu practice | English only | Approved translations, localized character instructions, language-aware state/reveal rules, evaluation and native-language review are required. |
| Multilingual report export | Missing | Current PDF uses Noto Sans and substitutes unsupported glyphs. Add script fonts, shaping and render checks; translating the UI is insufficient. |
| Personal/Business catalog | Missing as a configurable catalog | Current catalog and character are specific to the insurance scenario. Add audience/role metadata and a library; avoid separate products. |
| Text scenario authoring | Missing | Versioned scenario data exists, but there is no creator draft/review/publication workflow. |
| Voice, captions and animated avatar | Missing | Need verified STT/TTS, permissions, transcript confirmation, audio lifecycle, renderer and recovery behavior. |
| Camera and media sources | Missing | Current Permissions Policy blocks microphone/camera globally. Private storage, consent, provenance, retention and analysis adapters are absent. |
| Public release | Pending | AWS/HTTPS, scheduled purge, deployment recovery and deployed live acceptance remain required. |
| Advanced features | Roadmap | Additional language cohorts, video analysis, 3D avatars, organization administration, billing and mobile apps must not delay the core slices. |

## Decisions that reconcile V5 with the product

1. **Keep scores for every enabled practice session.** The user-requested numeric report card stays. Coverage and provisional status remain separate from the score.
2. **Separate length from quality.** V5 requires that a response over 70 words be rejected before generation or authoritative writes. Length must not lower semantic, factual, coaching or pronunciation scores. Introduce a new versioned quality rubric and a separate length panel. Do not silently change saved v1/v2 scores or recalculate the existing 93/100 report under a different formula.
3. **Preserve old accepted turns.** Older sessions include responses over 70 words. Keep their text, events, snapshots and reports intact; identify them as accepted before the rule. Apply the new admission rule to newly submitted turns. A replay of an already committed idempotency key must still return its saved result, even for a historical long turn.
4. **Use a concrete scoring migration.** Recommend a new rubric with nine quality checks: remove the response-length check, preserve the five category weights, and calculate each category over its actual quality checks. Communication initially uses the existing collaborative-language check; it receives no automatic bonus for length compliance. Make check totals dynamic in the schema, UI, comparison and exports instead of hard-coding ten. Add relevance/structure only as a later, tested rubric version with verified evidence. Historical v1/v2 reports retain ten checks and their original calculations.
5. **Enable locales only as complete tested slices.** An enabled locale needs the scenario, character response, state/reveal behavior, coaching, comparison and report rendering to work. Translated prompts paired with English-only phrase evaluation would produce misleading scores.
6. **Keep policy facts canonical.** Represent amounts, currency, waiting periods, exclusions and conditions by stable fact IDs and values. Reviewed translations render those facts; they do not define new benefits or override constraints.
7. **Pin session and branch settings.** Changing preferences must not change existing histories. Forks inherit source scenario/localization/rule/rubric/locale settings. Any allowed language change is explicit, recorded and versioned.
8. **Ship one excellent character first.** Reuse Priya for the first multilingual text and voice slices. Add one personal role with its own facts/state/rubric only after the flagship is stable. Full business administration and 3D are later work.
9. **Gate speech and camera separately.** Existing Meta text integration is established; it does not prove STT, TTS or vision capabilities. Choose providers after documentation, access, licensing and actual language tests. Camera presence is not permission to retain recordings or analyze frames.
10. **Keep the established visual direction.** Preserve navy/violet dark mode and lavender/white light mode, with restrained animation, clear status, readable Indic typography and accessible controls.

## V5 step by step

### V5-01 Preserve the baseline and define release gates

Implementation and verification: [V5-01 baseline](V5_01_BASELINE.md).

**Priority:** P0. **Depends on:** current product.

- Refresh repository, listener, migrations, disk capacity and regression evidence without exposing credentials.
- Take and verify a database backup before the first migration; retain representative legacy sessions, branches and saved reports as migration fixtures.
- Write the capability/feature registry for Personal Edition, locales, voice, video input, camera coaching and 3D. Disabled capabilities must not appear usable.
- Freeze the supported canonical insurance facts and existing runtime/rubric versions.
- Capture regression cases for repeated questions and the incorrect stage transition from the reviewed conversation.

**Acceptance:** current English text, persistence, fork, evaluation, export and sharing flows remain intact; backup restoration procedure is concrete. No new capability is advertised as verified.

### V5-02 Enforce 70 words and separate length from quality

Implemented locally: [V5-02 acceptance](V5_02_ACCEPTANCE.md).

**Priority:** P0, first implementation slice. **Depends on:** V5-01.

- Add one shared, versioned word-count module used by the browser and server. For English/Hindi/Telugu spaced text, define lexical whitespace tokens containing Unicode letters/numbers; ignore standalone punctuation/emoji. Specify numbers, hyphens, apostrophes, line breaks and mixed scripts in examples.
- Use a reviewed language-specific tokenizer for scripts/locales where this convention is inappropriate; do not enable unsupported counting methods. Avoid browser/server ICU differences changing accepted counts.
- Show `words / 70`, remaining words and a clear edit prompt. Handle IME composition so Enter during composition does not submit. Keep separate byte/character safety bounds.
- Authorize and check committed idempotency first; then reject new empty or over-limit turns before provider admission, provider requests or authoritative state writes. Preserve the editable draft.
- Persist original accepted content plus word count, locale, algorithm version, constraint version, input modality and pass status in dedicated validation metadata. Do not mix these with simulation state or quality scores.
- Introduce the quality rubric version and separate length display described above, preserving old reports and historical accepted turns.

**Acceptance:** 0 lexical words is invalid; 1 and 70 pass; 71 fails. Rejection makes no model request and writes no turn/event/snapshot. API bypasses, Unicode, punctuation, code-switching, retries, historical retry replay and forks are tested. Quality does not change solely because an otherwise identical answer crosses the word threshold.

### V5-03 Make scenario behavior versioned and improve conversation progression

Implemented locally: [V5-03 acceptance](V5_03_ACCEPTANCE.md).

**Priority:** P0. **Depends on:** V5-02.

- Resolve state schema, transition rules, knowledge-reveal policy and rubric from the session's pinned scenario/runtime version.
- Preserve recorded trace replay separately from newly generated alternative outcomes.
- Replace broad keyword stage detection with explicit scenario milestones and allowed transitions. Reviewing an exclusion is not automatically a closing step; farewell text must not regress a completed milestone without a meaningful event.
- Track which objections/questions have been answered in the correct branch. Give Meta concise grounded context so Priya moves forward rather than repeatedly reopening resolved terms. Preserve meaningful challenges to contradictions.
- Keep model deltas bounded and all state/event/snapshot writes atomic. Do not invent model seed determinism.

**Acceptance:** the reviewed repetition/stage cases improve; a new child path cannot alter a parent's resolved objections or private knowledge; legacy runtime sessions still restore correctly.

### V5-04 Add locale and modality metadata safely

Implemented locally: [V5-04 acceptance](V5_04_ACCEPTANCE.md).

**Priority:** P0. **Depends on:** V5-03.

- Add locale registry and reviewed capability states, with `en-IN` as the backwards-compatible default.
- Add scenario audience, skill goals, difficulty, role and supported modalities; session practice/character/coaching locales, code-switch policy and mode.
- Add immutable localization version references; message source modality, original transcript metadata and optional labeled translations; rubric/feedback locale fields.
- Introduce provenance/consent/media metadata contracts without exposing nonworking upload or analysis controls.
- Store preferences using the existing ownership model for now. Do not build enterprise tenancy or billing to support a selector.
- Keep current branch-turn endpoints; extend their validated schemas rather than adding duplicate message/branch APIs from the brief's illustrative routes.

**Acceptance:** additive migrations preserve IDs, original messages, snapshots, report versions and access. Existing sessions read as English without rewriting their histories. Branches inherit pinned settings exactly.

### V5-05 Deliver English Hindi and Telugu text practice

Software and live-provider checks passed: [V5-05 evidence](V5_05_ACCEPTANCE.md). Native-language review and public release remain pending; Indic exports remain V5-06 acceptance work.

**Priority:** P0. **Depends on:** V5-04.

- Add interface/practice/coaching language selection with explicit fallbacks. Default the settings together but preserve their separate meanings.
- Prepare reviewed Hindi/Telugu scenario titles, instructions, character persona, approved facts and objectives from the same canonical facts.
- Pass locale, script, formality, code-switch policy and allowed facts to the existing server-only Meta adapter. Verify actual language behavior rather than assuming support from a model name.
- Add language-appropriate knowledge-reveal and policy-violation handling; do not leave English keyword rules in charge of Hindi/Telugu discovery or safety feedback.
- Keep original-script messages unchanged through reload, timeline, fork and comparison. Label optional translations and preserve the originals.
- Add locally bundled script fonts, IME support, wrapping and locale-aware numbers/dates. Other locales remain disabled or clearly coming soon.

**Acceptance:** at least five live turns plus reload/resume, an independent alternative and comparison work in each enabled locale. Amounts, exclusions and waiting periods remain unchanged. Native-language scenario review is recorded separately from automation.

### V5-06 Localize coaching report cards and exports

Local software/render verification: [V5-06 acceptance](V5_06_ACCEPTANCE.md). Fluent-speaker and target-reader acceptance remain pending; Telugu reviewer volunteered, Hindi unassigned.

**Priority:** P0. **Depends on:** V5-05.

- Provide reviewed language-appropriate rubric instructions, matching/evidence behavior and coaching text; separate content from delivery observations and self-reported confidence.
- Keep numeric report cards for enabled locales with transparent coverage. Reject invented or foreign message/event references. A supplemental model judge is optional and cannot override authoritative facts or fabricate evidence.
- Compare scores only under compatible rubric/locale versions; label cross-language comparisons when numerical equivalence has not been established.
- Extend PDF font fallback and shaping to Devanagari/Telugu and mixed-script runs. Verify DOCX font fallback on the target readers; do not substitute unsupported characters with question marks.
- Preserve current PDF/Word downloads and sharing behavior, with localized summaries, titles and evidence excerpts.

**Acceptance:** equivalent reviewed answers receive appropriately grounded feedback across the enabled languages. Every exported page is checked for conjuncts, rupee symbols, clipping, wrapping and legibility. Locale-specific user acceptance supplements automated tests.

### V5-07 Add the edition catalog and reviewed text Scenario Studio

Implemented locally for the verified English insurance template: [V5-07 acceptance](V5_07_ACCEPTANCE.md). Private drafts, catalog filters and operator review/publication are available; Personal templates and native/generic authoring remain gated.

**Priority:** P1. **Depends on:** P0 gates V5-01 through V5-06.

- Add Personal/Business library filters, goal, role and difficulty selection using scenario metadata.
- Implement private text drafts and versioned review/publication for objectives, characters, constraints, canonical facts, localizations and rubrics.
- Distinguish browser-owner draft access from permission to publish a shared catalog. Publishing must be restricted to an authorized operator/creator role; a demo cookie is not administrative authority.
- Track translation state as draft, reviewed and published. Reject publication with missing critical facts or rubric definitions.
- Keep current sessions pinned to their old definitions. Audio/video authoring remains disabled until its actual workflow exists.
- Optionally add one reviewed personal scenario, such as an interviewer, with its own bounded state and rubric. Do not force insurance logic onto a different role.

**Acceptance:** a reviewed scenario/localization can be published and selected without changing a running session. Personal and Business audiences are represented honestly; missing templates remain unavailable.

### V5-08 Verify speech providers and consent behavior

Local Meta transcription/consent implementation: [V5-08 acceptance](V5_08_ACCEPTANCE.md). Real API access and synthetic English transcription verified; microphone operation and clear, audible device playback passed by user report on October 30. This English localhost check is accepted; complete voice conversation remains V5-09.

**Priority:** P1. **Depends on:** V5-07 and completed text regression.

- Compare actual STT/TTS API access, supported languages, streaming/final transcripts, timestamps, cancellation, licensing, data handling and costs. Keep Meta as the character brain.
- Record a capability matrix per locale: text, STT, streaming STT, TTS, streaming TTS, code-switching, timing, latency and observed quality.
- Start with one locale proven end to end; do not enable Hindi/Telugu speech merely because text works.
- Add route-scoped microphone policy and user controls; keep camera blocked/off until its separate feature is ready. Require explicit recording/retention/analysis choices.
- Default to ephemeral speech processing. Retained audio requires private storage, consent, expiry and deletion; media bytes never go in PostgreSQL.

**Acceptance:** real recorded speech is transcribed, corrected/confirmed and played back in the intended language. Permission denial, unsupported language and provider failure return to text without losing state. Credentials are requested only when the selected integration requires them.

### V5-09 Build the live voice room and speaking 2D character

**October 30 implementation update:** local push-to-talk practice now includes opt-in device speech, Hindi/Telugu dictation and an interchangeable 2D Priya/portrait renderer. Native audio flows are user-accepted; character states, captions, cancellation and reduced motion are software-verified. See [2D character acceptance](V5_09_2D_CHARACTER.md). Earlier first-slice notes below are historical. Streaming/full-duplex and production release remain separate.

First local slice: [speech dictation in the practice composer](V5_09_DICTATION.md). English inline Speak/Stop automatically transcribes into the editable draft, with approval remembered in the browser and explicit Send connected to normal persisted turns. Automatic character readback, speaking 2D renderer, streaming and complete voice-room acceptance remain pending.

**Priority:** P1. **Depends on:** V5-08.

- Add an interchangeable avatar renderer; the existing portrait can be the static fallback. Start with a simple speaking animation, not a 3D world.
- Implement capture, partial transcript where verified, final transcript review, shared 70-word validation, normal turn commit, TTS, captions and playback cancellation.
- Keep turn processing ordered. Partials, discarded captures and cancelled uncommitted utterances never become authoritative turns. A committed response remains committed even if its audio is interrupted.
- Add mute, stop playback, reconnection and text fallback, plus latency measurements. Do not promise full-duplex barge-in unless it is actually supported and tested.
- Animate from verified timing or approximate audio energy and label the approximation. The renderer cannot mutate simulation state.
- Associate transcript timing and optional evidence with the correct branch; changing paths stops old capture/playback so late results cannot write into the new path.

**Acceptance:** at least one role completes a real two-way spoken exchange with captions and visible speaking reaction. Corrections, 70/71-word speech transcripts, interruption, retry, reconnect, fork and provider failure are tested. Text mode still works independently.

### V5-10 Add private audio and video authoring sources

**October 31 local implementation:** [V5-10 acceptance](V5_10_ACCEPTANCE.md) records delivered private sources, reviewed/versioned transcripts, publication gating and deletion. Own-clip human review and deployment remain separate.

**Priority:** P2, optional. **Depends on:** verified voice slice and media consent/storage design.

- Add private object storage, source provenance, locale, processing status and versioned transcripts.
- Support audio/video reference upload only with validated type/size checks, private access, explicit consent, retention and deletion controls.
- Require creator review of transcription/translation before publication.
- A video clip may contribute a reviewed transcript; scene understanding needs a separately verified video/vision capability. Keep unavailable analysis explicitly disabled.

**Acceptance:** one retained asset can be authorized, processed, reviewed, linked to a scenario version and deleted. Other owners cannot read it. Failed processing cannot publish unreviewed content.

### V5-11 Add optional camera presentation feedback and language expansion

**Priority:** P2, independently gated modules. **Depends on:** V5-10 for retained evidence; ephemeral preview may be implemented separately.

- Camera preview/capture permission is independent of microphone, retention and analysis consent. Preview alone must not upload or analyze frames.
- Only verified adapters may provide observable cues such as framing or face visibility, with uncertainty and timestamped evidence. Do not infer emotion, honesty, personality, intelligence or clinical confidence.
- Add Tamil/Kannada/Malayalam/Marathi/Bengali, then Gujarati/Punjabi only as individually reviewed text/speech/export slices. No all-22-language claim.
- Add optional private learning goals, repeated attempts and self-rated confidence; avoid comparing incompatible rubric/locale versions as progress.

**Acceptance:** camera-off stops capture/processing; deletion removes retained evidence. Each newly enabled language passes the same full-text and export gate, plus a separate speech gate if offered.

### V5-12 Expand the platform after the core release

**Priority:** P3. **Depends on:** validated demand and completed preceding release gates.

- Richer 2D/3D avatars, facial rigging and verified full-duplex conversation.
- Account identity, organization membership, roles, approved team libraries, assignments, audits and team analytics.
- Pricing/billing and broader longitudinal coaching only after the appropriate product and privacy design.

**Acceptance:** scoped separately. These features must not delay the flagship text or basic voice release.

## Migration order

1. Back up and verify the existing PostgreSQL database; refresh the English baseline.
2. Add independent response-validation metadata and runtime/rubric version contracts. Preserve existing response content and saved scores.
3. Add nullable/defaulted locale, audience and modality fields; read legacy data as `en-IN` through explicit compatibility logic. Never backfill by translating old transcripts.
4. Seed new reviewed localization versions alongside existing scenario definitions. Pin version references when a new session starts.
5. Add speech/media metadata and private-object references only when the corresponding feature slice is ready. Retention and deletion must include shared branch references so deleting an asset cannot silently break surviving evidence.
6. For each migration, run relevant unit/database/browser regressions and compare legacy messages/events/snapshots before and after. Roll back by disabling the new feature and using the preserved data, not by destructive database reset.

## Release boundaries

- **Next multilingual text release:** V5-01 through V5-06. This is the minimum complete new foundation.
- **Voice and 2D release:** V5-07 through V5-09 after the text gate. Select only speech locales actually verified.
- **Optional expansion:** V5-10 and V5-11 do not block the text/voice release. V5-12 is post-core work.
- Before any public release, complete the existing AWS Ubuntu deployment gate: HTTPS, exact origins, secure cookies, backup/restore, restart recovery, scheduled purge, private media access if applicable, deployed live conversation and representative device checks. Local testing remains first, per the user's hosting preference.
- **Existing Phase 8 demo/submission remains deferred.** The brief's build dates, deadline, theme and judging claims must be checked against the participant guide before scheduling submission work; they were not independently verified in this planning review. Do not equate the old nine-day schedule with an estimate for all V5 capabilities.

## First implementation ticket

Start with **V5-02, after the V5-01 baseline**: enforce the 70-word rule in one English text path, persist independent validation metadata and introduce versioned scoring separation. Demonstrate: 70 words commit once; 71 words stay a draft with zero provider calls and zero authoritative writes; an older long turn and saved v2 report remain readable and unchanged; a committed historical retry still replays. Then extend the same contract through the locale slices.

Do not start voice, camera, 3D, deployment or the deferred demo as part of that first ticket.
