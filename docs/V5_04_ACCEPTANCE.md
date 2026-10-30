# V5-04: locale and modality metadata

Implemented locally October 29, 2026. This phase adds metadata and contracts. English text remains the only available practice mode; language selectors, translations, speech and media analysis are later phases.

## Additive storage

Migration `20261029000100_locale_modality_metadata` adds nullable JSON fields, leaving historical payloads intact:

| Record | Added field | Purpose |
| --- | --- | --- |
| Scenario | `catalogMetadata` | Audience, skill goals, difficulty, trainee role and supported modalities |
| SimulationSession | `settings` | Pinned interface/practice/character/coaching locales, mode, code-switch policy and localization reference |
| Branch | `settings` | Exact inherited session settings; drift is rejected |
| Message | `sourceMetadata` | Original text/script, configured source locale, modality, provenance and optional labeled translation/transcript contracts |
| Evaluation | `localeMetadata` | Practice, rubric and feedback locale plus localization reference, separate from the immutable scored findings |

New `ScenarioLocalization` records identify a locale/version and immutable baseline content. A database trigger rejects update/delete; a new revision must be a new row. New practices pin the English baseline ID, version and SHA-256 digest. The digest and approved content are checked before generation. English content status is **baseline**, not a claim of new human translation review. A clean install and repeated seed both create exactly one English baseline.

New `PracticePreference` records are scoped to the existing browser owner hash. No accounts, organization tenancy or billing were introduced. Preferences expire after 30 days and are included in retention cleanup.

## Defaults and preserved history

Historical null settings read as `en-IN` for interface, practice, character and coaching, with text mode and `preserve_original_with_english_coaching`. Their localization source is explicitly `embedded_legacy`; no localization ID/hash is invented for an old record. These defaults describe the configured practice, not automatic language detection of every message.

Existing messages receive source metadata only in the read response, marked `sourceInferred`; their stored text and metadata are not rewritten. New messages store original text verbatim, including whitespace and mixed scripts. Forks inherit the same pinned settings and shared message metadata, while retaining their existing runtime and snapshot rules. Changing/resetting preferences affects future practices only.

Historical evaluation JSON and scores are unchanged. Missing locale metadata is inferred as legacy English separately from report findings. New evaluations persist their locale metadata beside the report. No existing report is recalculated by the migration.

## Validated APIs and capability states

- `GET /api/capabilities` now includes the locale registry. English text follows the existing release gate. Hindi and Telugu remain `not_reviewed` / `not_verified`, unavailable even if their environment flags are true.
- `GET`, `PUT` and `DELETE /api/preferences` read, save and reset the calling browser's settings. Responses are not cached; writes require the configured application origin. The API returns whether a preference record is saved, without exposing owner identifiers. Saves use shared usage limits.
- `POST /api/sessions` accepts validated optional locale/mode/code-switch settings and pins the server-selected localization. `{}` continues to work. Disabled locales, voice mode, forged localization references and unknown fields are rejected.
- The existing branch-turn route accepts optional `inputModality: "text"`. Locale comes from the session pin. Clients cannot supply raw source/provenance metadata, translations or arbitrary media modes.

There are no new language/media controls in the interface. Camera and microphone remain denied by the existing Permissions Policy. The current scenario's default catalog audience is Business, difficulty intermediate, with text as its sole modality; this does not enable enterprise administration.

## Future media contracts

Versioned schemas define labeled translations with review provenance, confirmed transcript metadata, explicit consent purposes and expiry, private media provenance/digests and retention bounded by consent. Text has no implied media consent. These schemas are contracts only: no upload, recording, transcription, source storage, consent collection or analysis service is enabled. Future media admission must verify actual ownership and consent records; a matching JSON shape alone is not authorization.

## Verification

- Pre-migration backup: isolated restore passed, 10 tables / 1,244 rows, schema and all row fingerprints matched.
- Immediately after migration, all original columns across eight product-data tables / 1,059 rows matched. After regression tests, those same original IDs/columns were compared against a fresh isolated restore of the pre-migration archive and still matched. Added synthetic test fixtures and changing usage counters are excluded from this historical-data comparison.
- Post-migration backup: isolated restore passed, 12 tables / 1,221 rows, schema and all row fingerprints matched. Both temporary restore databases were removed. Private archives/manifests remain ignored under `.backups/`.
- Five migrations applied; Prisma reports no pending migrations and an empty schema diff.
- Clean temporary database: all five migrations passed; seed and repeated seed passed, with one scenario, one English localization and zero sessions. The temporary database was removed.
- 100 unit checks and 47 PostgreSQL checks pass, covering defaults, exact source text, pinned settings, forks, preferences/expiry, immutable localization records and unsupported mode/locale rejection.
- Full Chrome suite: 34 passed. The final preference save/reset and isolation check also passed on its targeted rerun.
- Restarted localhost verified pinned English/text metadata and original source content, with zero unexpected navigations or HMR reloads during a 20-second observation.
- Lint, TypeScript, production build, client privacy scan (16 files) and whitespace checks pass. No paid provider requests or AWS deployment were performed for this phase.

Machine-readable evidence: `verification/v5-04/acceptance.json` and `preservation.json`.

Next: V5-05 adds reviewed language content, selectors and actual English/Hindi/Telugu behavior, with native-language review and live acceptance before enabling each locale.
