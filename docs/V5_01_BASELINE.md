# V5-01 baseline and release gates

Implementation date: October 28, 2026. Baseline commit: `d46ab72`.

## Preservation

No schema migration, reseed, scenario rewrite or historical report recalculation was performed. Four existing migrations remain applied. The pre-change database backup contains 10 tables and 873 rows, including 44 sessions, 64 branches, 298 messages and nine saved evaluations. Integration/browser tests create fictional fixtures; those counts describe the preserved snapshot, not the current database.

The private custom-format archive and fingerprint manifest are in `.backups/`, ignored by Git. Directory permissions are 0700 and files 0600. The helper takes a PostgreSQL repeatable-read snapshot, fingerprints every application table and its columns/constraints/indexes, dumps that same snapshot, restores into a unique temporary local database, compares every table's row count and SHA-256 plus schema fingerprint, and removes only the temporary database. An archive SHA-256 detects damage before re-verification. The original database is never a restore target.

```sh
npm run db:backup:verify
# Recheck the preserved V5-01 archive:
npm run db:backup:verify -- --archive .backups/2026-10-28T16-01-56-196Z-47d0461b.dump
```

Requires PostgreSQL 15 command-line tools, the local app DATABASE_URL for a new dump, and a local OS database role allowed to create/drop temporary databases. Administrative tools explicitly use the `/tmp` local socket. Restore verification can run from an existing archive plus its adjacent manifest without application credentials. Keep both files together. Only use trusted local archives. Private diagnostics remain in `.backups/` on failure. This helper verifies restoration into isolation; replacing a live database remains a separate recovery operation. Keep an additional encrypted copy outside this machine before deployment.

## Capability contract

`GET /api/capabilities` returns only public availability/reasons with `Cache-Control: no-store`. English text is the only shipped capability. `PERSONA_ENGLISH_TEXT=false` disables new sessions at the service layer and both studio entry buttons; saved history stays readable. Only exact `true` enables a verified capability; malformed values fail closed. No credentials or environment configuration are returned.

Hindi, Telugu, Personal Edition, voice, video input, camera coaching and 3D remain unverified and unavailable even if their environment flags are true. No unsupported controls are added. Future implementation must deliberately update reviewed code gates and its tests; environment flags alone are insufficient.

Session creation continues to accept `{}` or an empty body. Optional `mode: "text"` and `practiceLocale: "en-IN"` describe the existing contract only; unsupported values/fields are rejected before ownership creation or database writes. This does not add locale storage, language switching or voice support. English text provider settings are unchanged.

## Frozen fixtures and known findings

- `tests/fixtures/v5-01/baseline.json`: approved policy facts and amounts, waiting periods, exclusions, constraints, opening, initial state, runtime identity and v1/v2 rubric identities. Add new versions deliberately rather than rewriting this fixture.
- `legacy-history.json`: synthetic pre-rule 71-word response, child branch and immutable v1/v2 reports; tests validate exact report interpretation and inherited evidence. Real historical sessions/reports remain in the private verified archive, not in source control.
- `repeated-question.json`: synthetic repeated premium question with future acceptance criteria. This records the finding; it does not claim model behavior is fixed or provide new live-provider proof.
- Two `it.fails` stage cases reproduce premature closing and farewell regression. These expected failures are explicitly tracked V5-03 defects, not fixed behavior. When the reducer is corrected, convert them to ordinary passing tests.

V5-02 will add the 70-word admission rule and a new quality rubric. V5-03 will add runtime dispatch and progression/repetition fixes. Existing v1/v2 scoring is unchanged here.

## Verification

See `verification/v5-01/acceptance.json` for refreshed results. Browser tests use the deterministic mock provider on isolated port 3101; the localhost app on 3100 retains its private Meta configuration. Existing user-reported physical-device, native zoom, VoiceOver and sharing acceptance remains historical evidence. This phase neither deploys to AWS nor repeats paid Meta acceptance.
