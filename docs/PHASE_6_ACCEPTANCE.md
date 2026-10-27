# Phase 6 — Visual polish and local accessibility acceptance

Local implementation and acceptance completed October 27, 2026. Native screen-reader listening, native browser zoom and physical-device coverage remain explicit release checks below.

## Visible design upgrade

The studio now opens with a large portrait-led hero: editorial typography, violet primary action, a clear Converse → Rewind → Compare journey, and a separate scenario/focus brief. The previous abstract opening and lower portrait card have been replaced. Existing original fictional imagery and locally bundled fonts are reused.

Practice now has a conversation-room heading, a contained branch toolbar, a prominent **Field notes · Evaluation** action, larger message surfaces, a direct timeline link, and clearer saved-state markers. Comparison and reports carry the same navy/slate surfaces, editorial headings and layered panels. Original/alternative branches retain violet/periwinkle identification without assigning meaning by color alone.

The later palette follow-up removes all remaining mint/green accents. Current palette captures are in `screenshots/palette-restored/`; Phase 6 screenshots below remain historical evidence of the initial redesign.

## Verified locally

| Area                      | Evidence                                                                                                                                                                                                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Responsive studio         | Reviewed captures and selected-rule axe scans at 1440 × 1000, 768 × 1024, 390 × 844 and 320 × 800 CSS pixels; no horizontal overflow and portrait loads at every size.                                                                                                                    |
| Keyboard journey          | Skip link → main focus; keyboard scenario brief with focus return; start; unsupported guarantee; evidence-linked report; exact message focus; rewind; named alternative; corrected response; comparison. Dialog focus stays contained across repeated Tab navigation.                     |
| Evidence focus repair     | Dialog closure now transfers focus to the selected evidence message through Radix's close-focus callback. Normal Escape dismissal still returns focus to the opener. It no longer races against automatic opener restoration.                                                             |
| Reflow and larger text    | Practice, branching drawer and evaluation checked at 320 CSS pixels with reduced motion. A separate 24px body/control text stress test passes without horizontal overflow. This is not a native browser zoom result.                                                                      |
| Contrast and preferences  | Low-contrast composer hints, current timeline text and warning counts were corrected. Nine new axe scans cover selected WCAG 2 A/AA, 2.1 AA and 2.2 AA rules. Existing selected-rule scans also pass. Forced-colors mode uses system caption/button surfaces and a visible focus outline. |
| Assistive semantics       | Main/navigation/dialog/log regions, accessible control names, associated inputs, polite conversation log, progress status, error alert and explicit focus targets are checked. These checks do not prove audible screen-reader output.                                                    |
| Progress, draft and retry | Delayed provider response exposes a status and disables sending. Injected 502 preserves the draft through reload, commits no partial turn, then retries to exactly one committed turn.                                                                                                    |
| Expiry and read failure   | True PostgreSQL expiry prevents listing/reading/continuing a session. Browser checks verify an expired-session recovery link and a temporary read failure that recovers with Try again. Database/provider UI failures are injected at the browser boundary; the database was not stopped. |
| Connection messages       | Failed network and unreadable responses use understandable recovery text. Lost responses advise reloading saved history rather than asserting that a possibly committed turn was never saved.                                                                                             |

The automated keyboard rehearsal finishes in roughly 4–8 seconds in the recorded runs; that measures automation, not a timed human usability study. The exact final duration is in the evidence JSON.

## Checks and evidence

- `npm test`: **44 unit tests passed**.
- `npm run test:integration`: **19 PostgreSQL tests passed**.
- `npm run test:e2e`: **18 browser tests passed in 47.5 seconds**; the subsequently added forced-colors test also passed in a targeted run (19 browser checks total).
- `npm run lint`, `npm run typecheck`, `npm run build`: passed.
- Updated local production server and client privacy scan: results in `PHASE_STATUS.md`.

New checks: [browser polish acceptance](../tests/e2e/polish.spec.ts), [actual expiry](../tests/integration/expiry.test.ts), and [connection recovery](../tests/unit/client.test.ts). Test sessions are isolated and deleted by their fixtures. Browser mock tests use 3101 and make no paid provider requests. Historical Phase 1–5 captures/results are preserved after routine test reruns.

Screenshots:

- [Redesigned studio, desktop](screenshots/phase-6/studio-desktop.png), [tablet](screenshots/phase-6/studio-tablet.png), [mobile](screenshots/phase-6/studio-mobile.png), [320px](screenshots/phase-6/studio-reflow-320.png).
- [Practice](screenshots/phase-6/practice-desktop.png), [evaluation](screenshots/phase-6/evaluation-desktop.png), and [comparison](screenshots/phase-6/comparison-desktop.png).
- [Narrow practice](screenshots/phase-6/practice-reflow-320.png), [narrow evaluation](screenshots/phase-6/evaluation-reflow-320.png), [larger text](screenshots/phase-6/practice-larger-text.png), and [forced colors](screenshots/phase-6/studio-forced-colors.png).
- [Actual rebuilt production studio](screenshots/phase-6/production-studio.png), opened visibly in the in-app browser in Meta mode without starting a model conversation.

Structured evidence is in [studio reflow](verification/phase-6/studio-reflow.json), [keyboard rehearsal](verification/phase-6/keyboard-rehearsal.json), [narrow/text checks](verification/phase-6/reflow-and-text.json), [draft retry](verification/phase-6/draft-retry.json), [recovery](verification/phase-6/recovery.json), and [forced colors](verification/phase-6/forced-colors.json).

## October 28 follow-up

[Follow-up findings, fixes, cross-engine evidence and human checklist](PHASE_6_MANUAL_REVIEW.md). Eight checks now pass in each of Chrome, Firefox and WebKit. Page identities, composer focus, pointer-opened dialog return focus and local phone-review compatibility were improved. Human native zoom, audible VoiceOver, actual devices and comprehension results are still awaited.

## Release validation still open

- Listen through the complete journey using VoiceOver/NVDA, including transcript and error announcements. Accessibility-tree and automated semantic checks are not a substitute.
- Verify actual native browser zoom at 200%/400%, plus platform text scaling. Native Chrome control was interrupted during this run, so no native zoom pass is claimed. Reflow and larger-text results above remain separate evidence.
- Test actual iOS/Android touch devices and Safari/Firefox. Chrome, Firefox and Playwright WebKit automation now pass; actual Safari and physical-device review remain separate.
- Run a human timed rehearsal and collect comprehension feedback. Automation timing does not demonstrate human usability.

This is local acceptance of the implemented redesign and listed checks, not accessibility certification or public release acceptance. Phase 7 must retain these checks alongside deployment security, rate limits, retention cleanup and deployed/live verification.
