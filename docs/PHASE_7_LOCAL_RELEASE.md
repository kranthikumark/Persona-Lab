# Phase 7 — Local release validation, then AWS

The user selected localhost validation first, followed by deployment to their AWS Ubuntu instance. No AWS resources, credentials, DNS, security groups, or running services have been changed.

## Implemented safeguards

- PostgreSQL-backed admission counters are shared across app processes: 300 generation attempts per hour globally and 40 per browser owner. Mock and live generation use separate namespaces. Failed provider attempts consume admission; an already committed idempotent retry does not call the provider or consume another generation reservation. These are request caps, not token or dollar guarantees.
- A shared 100-per-minute session-creation admission cap applies even when clients clear their cookies. Session creation retains the 20-per-owner daily persisted-session quota and branching the ten-per-session quota. PostgreSQL transaction advisory locks serialize count-and-create operations so concurrent requests cannot pass the last available slot together. Cookie ownership is browser-scoped access, not an account identity; an edge abuse policy remains part of AWS acceptance.
- Generation commits check ownership and session expiry again. A response that finishes after expiry cannot commit a turn.
- Request JSON is limited to 12,000 actual bytes while streaming, including chunked requests without a Content-Length header. Access, validation, provider, usage, and server error responses use `Cache-Control: no-store`. Invalid ownership cookies are replaced when creating a session.
- `npm run db:purge` deletes up to 100 expired sessions per invocation, including branch references, messages, snapshots, events, retry records, and reports through cascades. It also removes expired usage counters. Concurrent cleanup workers claim separate session batches. The command logs counts only. It is available but no scheduler has been installed locally or remotely.
- `npm run release:check` validates origin/database/provider configuration and scans production client files for actual private credentials, database URL, private character instructions, and server-only markers. It prints no secret values. This complements the API access/projection tests; it is not a repository-history or complete secret audit.

## Local acceptance

Local checks passed October 27, 2026:

| Check                                     | Result                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Unit / PostgreSQL integration             | 47 / 26 tests passed                                                                        |
| Full mock browser suite                   | 19 passed, 47.5 seconds                                                                     |
| Production live Meta journey              | Passed, 1.1 minutes; seven actual generations and successful cleanup                        |
| Lint / typecheck / build                  | Passed                                                                                      |
| Migrations                                | All three applied; schema up to date                                                        |
| Configuration / production client privacy | Passed across 16 files                                                                      |
| Cleanup CLI                               | Passed; zero expired records present; actual aggregate deletion covered by integration test |

Results are recorded in `verification/phase-7/`. Local automated testing is separate from AWS/public acceptance. The initial full browser attempt was interrupted after a generated-cache disk error; after deleting only `.next-dev`, the full rerun passed. No user source or dependency files were deleted to recover space.

The Phase 6 palette follow-up removes the remaining mint and green tints. Studio, history, practice, timeline, comparison, evaluation, and focus use navy/slate, violet, and periwinkle. Current captures are in `screenshots/palette-restored/`; earlier phase captures retain their historical appearance.

## Local run sequence

Use the existing private `.env`; do not paste credentials into terminal commands or documentation.

```sh
npm run db:migrate
npm run db:seed
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
npm run release:check
npm start
```

Run the build after browser tests finish: Prisma regeneration can invalidate an engine loaded by an overlapping test server. The app binds to `127.0.0.1:3100`. Mock browser tests use the isolated port 3101. A real local Meta journey can be run deliberately against the production server:

```sh
PERSONA_LIVE_VERIFY=1 PERSONA_VERIFY_PHASE=phase-7 npm run verify:live -- --grep 'real Meta: five'
```

That journey makes seven actual Meta generations, exercises five turns, reload, resume, private-knowledge boundaries, another browser's access denial, a saved-state alternative and comparison, then deletes its fictional test session. The separate invalid-credential browser test requires an intentionally misconfigured isolated server on 3102; it is not part of this command.

## AWS Ubuntu handoff after local review

1. Confirm the instance, domain, deployment directory, service user, and PostgreSQL destination with the user. No SSH or paid infrastructure provisioning is needed for localhost acceptance.
2. Install a supported Node runtime matching the repository's `node >=22` requirement and use the lockfile with `npm ci`. Keep the app and database credentials in a private environment file accessible only to the service user. Use a dedicated PostgreSQL role and database, with backups and an actual restore check.
3. Set `APP_ORIGIN` to the exact HTTPS origin without a trailing slash; configure the verified Meta model and key privately. Apply migrations and seed the fictional scenario. Run the build and privacy/configuration check on Ubuntu; macOS build output and native Prisma binaries are not deployment artifacts for Linux.
4. Run the Node service under a restartable service manager. Place an HTTPS reverse proxy in front of its loopback port 3100. Keep Node and PostgreSQL ports private; restrict administrative SSH access. Configure request/body limits and edge abuse controls before public access. Never log ownership cookies, API keys, database URLs or conversation bodies.
5. Schedule the cleanup command with the instance's service manager or scheduler, using the same environment and service identity. Run often enough to meet the agreed physical-deletion interval; each run handles 100 sessions, so monitor backlog and run additional batches if needed. Verify execution and aggregate deletion counts. Do not claim automatic physical retention until this exists and has run.
6. Verify the deployed HTTPS origin, secure/HttpOnly/SameSite cookie, migrations, access boundaries, usage limits, full live Meta journey, reload/resume, exact fork, comparison and report evidence. Record the actual deployed commit and results separately. Verify restart recovery and backup/restore, plus Phase 6 native zoom, audible screen-reader, physical-device/browser and human-rehearsal checks.

Phase 7 is complete only after those public deployment checks pass. Native/device review and AWS acceptance remain open even when every localhost check passes.
