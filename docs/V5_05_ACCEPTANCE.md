# V5-05: multilingual text implementation and acceptance

Updated October 29, 2026.

**Status: implementation, automated checks and live-provider checks passed. Native-language review and public-release acceptance remain pending.** Hindi and Telugu are available only in explicit local acceptance preview. English remains the normal enabled practice language. No native-speaker approval has been inferred from an AI output or a script check.

## Delivered

- A language-settings card selects the practice/character locale and saves browser-owned preferences. Interface and coaching currently use an explicit English fallback; these are separate pinned settings. Existing conversations keep their settings. A selected-language confirmation and a synchronous selection reference prevent a quick start or delayed preference load from starting the wrong language.
- Read-only Hindi/Telugu translation drafts can be opened from the normal studio even while practice options remain disabled. The card uses the existing navy/violet and light-theme tokens.
- Hindi and Telugu drafts include the scenario title, description, persona, opening, objectives, approved fact cards and practice labels. Fact IDs and canonical values remain the original insurance policy's values. The original English facts remain authoritative in the server and Meta context.
- Native contexts pin `insurance-v1-rules-v3-hi-IN` or `insurance-v1-rules-v3-te-IN`, a versioned immutable draft localization reference/hash and a presentation snapshot inside the session. Snapshot content drives the character prompt and scenario brief; it is not replaced by a later edit to the shared draft. Forks inherit it. English v1/v2 rules and stored reports remain supported.
- Meta receives the requested locale, script, respectful conversational style, code-switch instructions, canonical facts, localized fact wording and branch-local topic context. Recent dialogue stays in its original script. Unrevealed private knowledge is still omitted.
- Bounded Hindi/Telugu phrase adapters cover discovery questions, approved term assertions, guarantee negation, unsupported promises, next-step offers and pressure. Devanagari/Telugu digits are normalized only for analysis. Derived rule cues are never stored as replacement dialogue or sent as the trainee's message. These are limited phrase rules, not general semantic or policy verification.
- Native evaluations use `insurance-rubric-v4` / `localized-quality-v1` with nine quality checks and English coaching, explicitly labeled. Original message/event IDs and original-script evidence are retained and validated. Length uses the original response, not the expanded internal analysis cues. Existing v1/v2/v3 calculations are frozen.
- Noto Sans Devanagari/Telugu UI fonts are bundled locally with their licenses. Native text has language tags, wrapping and appropriate line height. Original script/whitespace survive reload, rewind, branch comparison and evidence links. Optional stored translations are labeled as reviewed or draft and displayed alongside the original, never in its place. No translation-generation endpoint was added.
- IME composition blocks Enter submission. Synthetic browser composition can insert a newline; that original text is deliberately preserved rather than trimmed to satisfy a test. Counters use the configured locale; history dates use locale-aware formatting.

## Release gates and scope boundaries

The default studio shows Hindi/Telugu as **review pending**, not ready for public practice. Environment flags alone do not promote an unreviewed language. `PERSONA_LOCALE_ACCEPTANCE=1` is honored only outside production with a loopback application origin; it is for local acceptance, not release evidence. Normal invocation has this flag off. The current localhost instance is deliberately running with the explicit preview flag so the user can perform acceptance; this does not promote the production gates. Production ignores it.

Native PDF/Word downloads are disabled in the UI and rejected server-side because the existing export renderer must not substitute unsupported Indic glyphs. Indic shaping, pagination, localized report content and file-sharing acceptance belong to V5-06. English exports continue to work. Native report cards remain available in acceptance preview, with the English coaching fallback disclosed.

Human review is separately tracked in [the review record](reviews/V5_05_LANGUAGE_REVIEW.md). Read the [translation packet](reviews/V5_05_TRANSLATIONS.md), including all conditions and negations, and refer to its exact content fingerprints in `reviews/V5_05_REVIEW_DIGESTS.json`. Fluent-speaker review, real native-keyboard input and audible screen-reader behavior are not claimed complete by headless automation. If corrections change critical draft content, create a new localization revision; do not overwrite an immutable row or relabel an old review as approval of new content.

## Verification

- **108 unit checks pass**: canonical fact IDs/values, native digits, discovery/reveal rules, guarantee negation, evidence validation, preserved originals, presentation cloning and release gates.
- **50 PostgreSQL checks pass**: five-turn native histories, localized evaluation metadata, exact reload, pinned content, inherited settings, independent branches, ownership and blocked unverified exports. No schema migration was needed for this phase.
- **34 routine English browser checks pass** on the final UI. **Four locale checks pass** across Hindi/Telugu and desktop/390px mobile widths, covering selection, IME, source preservation, font loading, no overflow, automated accessibility, score cards and comparison. Viewports and conversation panels were captured; the native-script panel images were visually inspected for wrapping, missing glyphs and clipping.
- Two live verification rounds were run. The final round verified **five original Meta turns plus one independent alternative in each language** (12 generated replies). Original and alternative replies passed native-script checks; reload, parent-trace preservation, inherited settings and Meta provenance passed. The final saved evidence is in `verification/v5-05/live-hi-IN.json` and `live-te-IN.json`. There were 24 total live generation calls across the two rounds; the final round added an explicit alternative-script check. Synthetic sessions were removed. No complete live dialogue, owner tokens or credentials are checked in.
- All **1,059 original product rows** from the pre-V5-04 archive still matched by ID and original column values. Test fixtures are excluded from this comparison. See `verification/v5-05/preservation.json`.
- Localhost normal-mode gates were verified closed using server capability responses and actual HTML option-disabled properties. The current server was then intentionally restarted in acceptance preview; Hindi/Telugu selection and a pinned Hindi setup were verified, with zero unexpected navigations or HMR reloads during a 20-second observation and no model generation during that UI smoke check.
- Lint, TypeScript, production build, whitespace checks and production client privacy scan (16 files) pass. English report/export and ownership checks remain green. No deployment was performed.

The browser work initially found a label-locator test issue, a real fast-selection timing issue and a test assumption that IME Enter could not add a newline. These were resolved by using the accessible combobox role, retaining the latest selected locale and asserting the exact accepted draft rather than silently trimming the original. Final locale runs pass without retries.

## Repeat verification intentionally

```sh
# Mock browser acceptance; starts its own isolated server on 3101:
npx playwright test --config playwright.locales.config.ts

# Six real Meta replies per locale; local private configuration required:
PERSONA_VERIFY_LOCALES=1 npm run verify:locales:live
```

For manual local review, stop the existing server and use `PERSONA_LOCALE_ACCEPTANCE=1 npm run dev`; it binds to loopback and uses the configured provider. Normal `npm run dev` keeps unreviewed native practice gated and exposes the read-only review packet in the studio. Review approval and V5-06 export acceptance are still required before changing the public gates.
