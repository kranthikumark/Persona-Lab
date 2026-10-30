# V5-02: response admission and independent quality scoring

Implemented locally October 28, 2026. No database migration or reseed was needed. Existing messages, snapshots, branches and saved v1/v2 evaluations were preserved.

## Response admission

The browser and server share `lexical-whitespace-v1`: split on JavaScript Unicode whitespace; count a token once if it contains a Unicode letter or number. Standalone punctuation/emoji do not count. Apostrophes, hyphens, currency amounts and joined scripts inside a token do not split it. Examples: `don't` = 1, `30-day` = 1, `₹1,250` = 1, `hello—world` = 1, `hello world` = 2, and `🙂 — ...` = 0. Hindi/Telugu and mixed-script counting are tested; this does not enable those practice locales. Counting does not depend on Intl.Segmenter or platform ICU.

New trainee responses must contain 1–70 words and fit the independent existing 2,000 UTF-16-code-unit safety bound. Request bodies retain their 12,000-byte cap. The composer displays words/70, remaining words, an edit prompt and a secondary character counter. Invalid input stays editable, survives reload, and cannot be sent through Enter or the submit button. IME composition, including Enter/229 handling, blocks submission until composition ends. Shift+Enter remains a newline.

The service authorizes ownership and checks committed idempotency keys before word validation. Invalid new inputs are rejected before provider budget admission, provider calls and message/event/snapshot/request writes. Existing committed long turns replay without another generation. Different content under the same key remains a conflict. Legacy retries also preserve the old edge-whitespace trimming behavior only when the corresponding historical message lacks new validation metadata. New accepted input is stored verbatim, including edge whitespace.

Accepted messages receive a dedicated `metadata.validation` record with word count, `en-IN`, counting version, `response-70-v1`, text modality and passed status, in the same transaction as the turn. This metadata is separate from simulation state and scores. Forks inherit the original metadata. Missing pre-rule metadata is labeled **Accepted before this rule**, including historical responses over 70 words; these are not retrospectively rejected.

## Quality rubric v3

New evaluations use `insurance-rubric-v3` / `quality-report-v3`: nine quality checks across the same five weights (30/20/20/15/15). The response-length check is removed. Each category earns `demonstrated checks / category checks × 100`; communication now has one collaborative-language check. Concerns and missing evidence earn no quality points. Coverage counts concerns as assessed, independently from points.

A greeting without recognized quality evidence scores 0, rather than receiving length points. Full quality evidence still scores 100. Quality is unchanged when neutral filler alone takes an otherwise identical response over 70 words. Historical long responses can be evaluated under v3, but new long responses are rejected on submission.

Reports, comparisons, PDF/Word and email/WhatsApp summaries use the report's own check total. A separate **Response length** section lists each turn's count and acceptance status. Length compliance earns no quality points. The existing insurance scenario's approved facts and weights remain compatible with v3 evaluation; the saved scenario payload is not rewritten to change its historical rubric identity. Executable runtime dispatch remains V5-03 work.

Frozen `legacy-rubric.ts` and `v2-rubric.ts` retain exact historical calculations and validators. Existing v2 cards are displayed as saved, with an explicit refresh notice for a new v3 record. Refresh creates a separately versioned evaluation; it does not replace the original. Export requests can identify the displayed saved report so downloading a v2 card does not silently substitute a v3 score. Ownership, branch scope and current revision are checked.

## Verification

- 85 unit checks pass, including the two expected stage-transition failures already tracked for V5-03 (83 ordinary passes).
- 35 PostgreSQL checks pass, including rejection before provider admission/writes, raw Unicode storage, metadata, forks, 70-word acceptance, idempotency replay and preservation/export of historical v2 reports.
- The full mock Chrome suite passed its 30 existing checks. The two new desktop/320px checks found a low-contrast conversation label. Its foreground now uses the existing accessible muted token and its text is 9px. Both new checks and export/sharing acceptance then passed together: 32 distinct browser checks covered across the runs.
- Browser checks cover draft persistence, direct API bypass, IME submission blocking, numeric quality reports, separate length, overflow and automated accessibility.
- Localhost was restarted after build/browser verification: the 71-word draft is blocked, and a 20-second browser observation recorded zero unexpected navigations or HMR reloads. The synthetic session was removed; no provider request was made.
- Lint, TypeScript, production build and client privacy scan pass. No paid Meta requests were made during acceptance. No AWS deployment was performed.

Screenshots: `screenshots/v5-02/report-1440.png` and `report-320.png`. Refreshed machine-readable evidence: `verification/v5-02/acceptance.json`.

New screen-reader announcements and physical-keyboard IME behavior are implemented and software-tested; this is not a new audible VoiceOver or physical-device acceptance claim. Repetition/progression fixes remain V5-03. Voice and multilingual practice remain gated off.
