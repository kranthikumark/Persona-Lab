# PERSONA LAB visual system

## Direction

A calm, premium decision studio: human character photography, a dark navy canvas, crisp conversation surfaces, restrained violet actions, and mint alternative paths. Shared history and the moment of divergence carry the product identity. Decorative charts, voice controls, and invented performance statistics are excluded.

## Tokens

Tokens are defined in `src/app/globals.css`.

| Role               | Token / treatment                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Canvas             | `--background`, `#101218`                                                                   |
| Panels             | `--surface`, `--surface-raised`                                                             |
| Text               | `--foreground`, `--muted`; secondary labels must retain contrast                            |
| Original/action    | `--violet`, `#b8a1ff`                                                                       |
| Alternative/status | `--mint`, `#9cddc7`                                                                         |
| Policy warning     | `--amber`, `#e7bf87`, always paired with text                                               |
| Typography         | `--font-body` Inter Variable; `--font-heading` Manrope Variable; `--font-editorial` Georgia |
| Spacing            | `--space-1/2/3/4/6/8`: 4, 8, 12, 16, 24, 32 pixels                                          |
| Shape              | `--radius-control`, `--radius-panel`, `--radius`                                            |
| Focus              | `--focus-ring`, mint outline with an offset                                                 |
| Motion             | `--motion-fast`; short orientation transitions; reduced-motion override                     |
| Elevation          | `--shadow-panel`; subtle borders instead of pervasive glow                                  |

Locally bundled fonts avoid external font requests. The fictional portrait's provenance is in `ASSETS.md`.

## Components and behavior

- **Navigation:** desktop workspace sidebar; compact Studio/History/Practice links on smaller viewports. The selected page uses `aria-current`. The skip link moves keyboard focus directly to the page's main region.
- **Actions:** CVA button variants for primary, secondary, ghost, small, and icon actions. Disabled and pending states remain visually distinct.
- **Scenario card:** character portrait, fictional scenario label, task, duration, primary start action, and accessible policy brief.
- **Messages/composer:** speaker names, turn labels, inherited-history labels, preserved draft, send/pending state, and retry feedback.
- **Character context:** persistent on desktop; an explicit Objectives & state disclosure on mobile. Important context is available rather than discarded at small sizes.
- **Timeline:** saved-state buttons, readable labels, current-state marking, and keyboard-accessible decision selection. Mobile uses a vertical list so decisions are discoverable without horizontal scrolling.
- **Drawers:** Radix dialog semantics, title/description, trapped keyboard focus, Escape/close, and return to the originating control.
- **Comparison:** shared origin and two labelled paths, expandable recorded prefix, stacked columns on mobile, and branch selectors that refresh the selected transcript. Changing paths clears stale content while the new view loads.
- **Recorded changes:** matched turn cards use violet/teal path borders and neutral signed deltas, with response evidence links. Missing turns remain explicitly empty. Shared and post-split findings are labelled; unequal conversation lengths carry a visible caution. Cards stack below 700 pixels.
- **Evaluation:** Field notes contains the five-category report. The evaluation action stays near the top, missing evidence uses an em dash, category details expose scoring rules and evidence, and an amber notice identifies outdated reports. Compact comparison reports expand independently per path.
- **History:** distinct loading, empty, populated, and recoverable error presentations. Loading never masquerades as an empty history.

## Truthful presentation

Mock screens identify the scripted provider. Live screens identify Meta. While session configuration loads, the shell says Connecting studio rather than guessing a provider. Comparison shows recorded differences and simulation indicators, not causal or psychological claims. Rubric reports label limited rule coverage and insufficient evidence, with explicit version and revision scope.

## Accessibility and validation

Use visible focus, semantic links/buttons, associated input labels, text alongside color, readable contrast, and no required hover-only actions. Reduced motion removes animations and smooth scrolling. Wait for actual animations to finish before automated contrast scans; partially faded frames are not the settled interface.

Phase 1 evidence, representative screenshots, and remaining release-level checks are recorded in `PHASE_1_ACCEPTANCE.md`.

Phase 4 adds reviewed desktop/mobile comparison captures and two selected-rule axe scans; see `PHASE_4_ACCEPTANCE.md`.

Phase 5 adds reviewed desktop/mobile evaluation captures and two selected-rule axe scans; see `PHASE_5_ACCEPTANCE.md`.
