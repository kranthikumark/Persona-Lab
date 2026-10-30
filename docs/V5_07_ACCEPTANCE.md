# V5-07 — edition library and reviewed text Scenario Studio

Implemented locally on October 29, 2026. This slice uses the verified insurance runtime; it does not turn the insurance engine into a generic interviewer or another character. Native-language human approval from V5-05/06 remains pending independently.

## What is available

- The home page has an edition, goal, role and difficulty library. Select a specific published scenario ID to start; the existing Begin practice shortcut keeps the flagship baseline.
- Business insurance practice is available. Personal filtering has an honest empty state. No Personal scenario, voice, video, media authoring or native-language authoring is advertised as usable.
- `/create` has private browser-owned, expiring text drafts. Authors edit title, description, learning objectives, intended difficulty and goals. Priya, the insurance-advisor role, constraints, canonical policy facts, text modality and rubric stay fixed to the executable insurance contract.
- Difficulty is an audience label, not a claim of dynamically adaptive behavior. Goals/objectives must fit the verified rubric; a human operator is responsible for that review.
- Draft saves use optimistic revision checks. Every save clears approval. Neither role fields nor review/publish status claims are accepted from the browser. Draft access is ownership-filtered; shared publications never disclose owner hashes or private character knowledge.
- A local operator inspects, reviews and publishes a particular revision through an OS command. There is no HTTP publication/review endpoint. Access to the server OS account is the authority boundary; enterprise identity and creator RBAC remain V5-12 work.
- Publication allocates a new catalog version under a database lock, records named review provenance and content hash, and is retry-safe for the same revision. Publication records and published Scenario rows are protected by PostgreSQL immutability triggers. Editing/deleting/expiring a source draft cannot delete the publication.
- Every new session copies the selected definition and catalog, pins its immutable localization and retains the same runtime/rubric compatibility checks. Existing sessions, reports, messages, snapshots and forks retain their definitions. Titles in the workspace, history and exported report use the pinned scenario.
- Only English baseline content can be authored/published in this slice. Hindi/Telugu baseline practice remains available only in the existing localhost acceptance mode, with human-review gates unchanged. A reviewed English variant cannot silently inherit unreviewed Hindi/Telugu content.

## Operator workflow

Create and save a private draft, then use the ID and revision shown under **How to request publication**. On the local server:

```sh
npm run scenario:operator -- inspect DRAFT_ID REVISION
npm run scenario:operator -- review DRAFT_ID REVISION --reviewer "Reviewer name" --approve
npm run scenario:operator -- publish DRAFT_ID REVISION
```

Inspect prints the draft content to the operator's terminal; handle private material accordingly. `--approve` is the operator's explicit attestation that they reviewed the full brief/objectives, the canonical facts, character, constraints, English content and rubric fit. Do not use automated test reviewer identities as human approval. Editing requires a new inspect/review before publication. Publications appear on the next library load.

## Preservation and acceptance

The pre-migration backup was restored into a scratch database: all 1,509 rows and schema matched. Migration `20261029000200_scenario_studio` only adds drafts, publications, indexes, the publication foreign key and immutability guards. SHA comparisons across all ten original product tables confirmed identical rows after migration; see `verification/v5-07/migration-preservation.json`.

`npm run test:catalog` provisions a disposable local PostgreSQL database using the local OS administrator, owned by the application role, applies the real migrations, runs publication acceptance, and drops that database. It never disables publication triggers in the user's database. The three catalog integration tests are intentionally skipped by the ordinary integration command unless the disposable-database guard is present.

Acceptance covers cross-owner isolation, invalid revision/field rejection, approval invalidation, missing-review rejection, concurrent idempotent publication, immutable published rows, source-draft deletion, expired-draft cleanup, selecting a published version, a mocked turn, independent fork, numeric evaluation/export data and unchanged running-session definitions. Browser checks cover both themes, filter/empty states, private save/reload, foreign-owner/foreign-origin attacks, missing publication route, keyboard-labelled fields, automated accessibility and 1440/390/320px reflow.

No live Meta request or human review was fabricated for these tests. Synthetic review/publication fixtures exist only in the disposable database. The user's shared catalog still contains only the existing flagship until a real operator reviews and publishes an authored draft.

## Verification results

- 120 unit tests and 50 existing PostgreSQL integration tests passed.
- Three additional publication integration tests passed in the disposable database; its removal completed.
- 43 unique browser checks verified across runs: 36 of 37 English checks initially passed; the tablet brand-name failure was fixed and all 12 affected design/polish/studio checks passed on rerun. Six Hindi/Telugu practice/export regression checks also passed.
- Lint, type checking, production build and release/privacy scan passed (19 client files scanned).
- Light/dark library desktop and creator phone screenshots were inspected. New editor/library checks include automatic accessibility and 320px reflow. See `verification/v5-07/acceptance.json`.
- After all regression runs, all 1,361 original product rows in ten tables still match the restored backup. Additional synthetic acceptance rows are counted separately; no original row was rewritten.

## Remaining boundaries

- Hindi and Telugu fluent-speaker approval and target-reader acceptance remain pending as documented in V5-06.
- Native-localization authoring and arbitrary character/fact/rubric authoring need separate runtimes and acceptance. The current editor deliberately locks those sections instead of exposing unsafe generic configuration.
- Personal templates remain unavailable until a complete role-specific runtime/rubric is built and reviewed; the optional personal scenario was not added in V5-07.
- AWS deployment, production OS operator access policy and scheduled draft purge require deployment acceptance. Existing `db:purge` now removes expired drafts as well as the existing expiring data.
- New editor screens have automated accessibility/reflow coverage; dedicated native VoiceOver and physical-phone testing of these new screens has not been claimed.
