# Phase 2 — Live conversation acceptance

Completed locally October 27, 2026, at approximately 16:24 IST, using the production build on `http://127.0.0.1:3100`, native PostgreSQL, and Meta `muse-spark-1.3`.

## Result

**Phase 2 acceptance passed.** Two opt-in Playwright browser tests passed in 47.5 seconds. Seven successful generated responses had server-side Meta/model metadata; no mock fallback occurred. Lint, TypeScript checking, and `git diff --check` also passed for the verifier addition. Application source did not change in this increment; the existing production build was exercised.

| Requirement | Observed result |
| --- | --- |
| Start and complete five turns | Scenario started through the browser; five real Meta responses persisted. |
| Reload and resume | Messages, events, snapshots, state, and revision matched exactly after reload. A sixth live turn correctly recalled the agreed summary-before-follow-up step. |
| Scoped access | A separate browser context could not read the session (404). |
| Tested knowledge boundaries | Budget and previous-experience facts stayed hidden in the first two responses and were disclosed after the relevant explicit questions. |
| Truthful provider identity | UI showed Meta live mode; database metadata verified all seven generated responses as Meta Muse Spark 1.3. |
| Recoverable provider failure | Isolated server with a deliberately invalid credential received upstream 401 and returned application 502 with a visible error and enabled retry. |
| No partial turn on failure | Messages, events, snapshots, revision, and idempotency records stayed unchanged. The unsent draft survived reload. |

Priya challenged “All claims are guaranteed,” accepted the correction, disclosed the tested facts when asked, and agreed to review a fictional policy summary before a follow-up. The persisted guarantee finding referenced the original recorded conversation.

A supplemental live branch check forked from the initial saved state, retained the shared opening message ID, generated an independent alternative response, left the parent unchanged, and displayed both actual transcripts in comparison. The original had six turns and the alternative had one: their final indicators are different-horizon simulation records and do not establish causal improvement. This smoke check does not close all Phase 4 requirements.

Observed browser turn times ranged from 3.5 to 12.2 seconds, averaging approximately 6.0 seconds across seven generations. These observations are not a latency guarantee.

## Evidence

- [Structured live conversation record](verification/phase-2/live-conversation.json): six original turns followed by one alternative turn, tested checks, model, timing, and final simulated states.
- [Provider failure record](verification/phase-2/provider-failure.json).
- [Live conversation screenshot](screenshots/phase-2/live-conversation.png).
- [Live comparison screenshot](screenshots/phase-2/live-comparison.png).
- [Preserved draft after reload](screenshots/phase-2/preserved-draft.png): the visible error was asserted before reload; this capture documents the retained draft.
- [Opt-in browser tests](../tests/live/conversation.spec.ts) and [configuration](../playwright.live.config.ts).

Only fictional training dialogue is included. No credentials, ownership cookies, raw upstream bodies, or browser network traces are published. The test-created sessions were deleted and their absence checked in PostgreSQL; referenced message IDs are historical evidence. The temporary invalid-credential server was stopped. The user's private configuration and main server were preserved.

## Reproduction

The live suite is deliberately excluded from routine mock tests. It makes seven real model requests and one invalid-credential request; use it only when live verification is intended. It expects the local scenario seed and database to be available.

1. Configure Meta privately in the ignored `.env` and run the production application on 3100 (`npm run build`, then `npm start`). Check listener ownership before starting another server.
2. In a separate terminal, run the same build on 3102 with an explicitly fake key. This command overrides the process environment without editing `.env`:

   ```bash
   AI_PROVIDER=meta META_API_KEY=persona-lab-intentionally-invalid-verification-key APP_ORIGIN=http://127.0.0.1:3102 node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3102
   ```

3. Run `PERSONA_LIVE_VERIFY=1 npm run verify:live` from the repository root. Local Chrome is required (CI uses Chromium). Screenshots and JSON evidence are overwritten; inspect before committing.
4. Stop the temporary 3102 process using its terminal. Keep the user's main application running.

The suite disables traces, video, automatic screenshots, and retries. It writes only explicit screenshots and selected evidence fields. Session cleanup runs in `finally` blocks.

## Boundaries and next phase

This acceptance covers the tested local scenario and inputs. It does not establish exhaustive knowledge isolation, policy/compliance accuracy, public deployment, account quota or billing readiness, accessibility certification, or real-world behavioral prediction. Knowledge reveal and guarantee detection remain documented limited rules. Full rubric evaluation remains Phase 5.

Next is Phase 3's formal state/timeline acceptance, including bounds, ordered references, duplicate requests, stale writes, and transaction rollback. Later phase audits remain open as shown in [phase status](PHASE_STATUS.md).
