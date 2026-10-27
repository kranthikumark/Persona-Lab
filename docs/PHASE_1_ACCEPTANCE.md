# Phase 1 — Visual system and complete interface

Scope: the three planned experiences and their responsive/keyboard behavior. Live-model acceptance belongs to Phase 2 and later; it is not required to close this design phase.

## Delivered

- [x] Documented color, typography, spacing, shape, focus, motion, and elevation tokens.
- [x] Cohesive scenario studio, practice workspace, and comparison workspace.
- [x] One original fictional character portrait, clear objectives, and approved policy brief.
- [x] Explicit mock/live/pending provider states.
- [x] Honest loading, empty, saved-history, and retry states.
- [x] Desktop sidebar and usable compact navigation with correct active-page semantics.
- [x] Collapsible mobile character objectives and simulated state.
- [x] Accessible timeline and saved-state fork drawer.
- [x] Shared-history disclosure and visible branch split.
- [x] Responsive stacked comparison with working path selection.
- [x] Keyboard focus indicators, drawer focus trap, Escape, and return focus.
- [x] Skip link reaches main content.
- [x] Reduced-motion behavior.

The initial prototype has been replaced by functional interfaces backed by local persistence. Design review uses explicitly labelled mock conversations rather than claiming that sample screenshots prove live Meta behavior.

## Verification

Design-specific Playwright checks cover desktop at 1440 × 1000 and mobile at 390 × 844:

1. All three screens, shared prefix, branch selection, policy/fork drawers, keyboard trapping and return focus.
2. Compact navigation, expandable context, vertical timeline, stacked comparison, branch selection, and reduced-motion drawer behavior.
3. Loading versus empty history, recoverable history error, retry, and keyboard skip-link focus.

Automated axe scans target WCAG 2 A/AA and 2.1 AA rules on studio, practice, comparison, and open drawers. Passing automated scans is evidence for these rendered states, not a claim of complete WCAG certification or physical-device/screen-reader acceptance.

Design tests use a separate mock server on 127.0.0.1:3101 and a separate development output directory. The user's app on 3100 remains configured for Meta. Test-created design sessions are deleted after each test; screenshots contain only fictional training dialogue.

Final command results are recorded in `PHASE_STATUS.md` after validation.

## Reviewed browser captures

| Experience         | Desktop                                             | Mobile                                            |
| ------------------ | --------------------------------------------------- | ------------------------------------------------- |
| Scenario studio    | [Desktop](screenshots/phase-1/studio-desktop.png)   | [Mobile](screenshots/phase-1/studio-mobile.png)   |
| Practice workspace | [Desktop](screenshots/phase-1/practice-desktop.png) | [Mobile](screenshots/phase-1/practice-mobile.png) |
| Branch comparison  | [Desktop](screenshots/phase-1/compare-desktop.png)  | [Mobile](screenshots/phase-1/compare-mobile.png)  |

## Deliberately outside Phase 1

Full five-turn/fork live Meta acceptance, complete rubric evaluation, production deployment, comprehensive assistive-technology/device review, and final release polish remain in their corresponding phases. Closing Phase 1 does not close those acceptance gates.
