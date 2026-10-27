# PERSONA LAB — Phase-by-phase implementation plan

Prepared: October 27, 2026

## Objective and starting point

Build a polished, text-first decision practice platform: meet a fictional customer, practice a conversation, revisit a saved decision, try another response, and compare simulated outcomes with evidence-grounded feedback.

The workspace was initially inspected on October 27 with no application code. A dedicated local Git repository has since been established and connected to `https://github.com/kranthikumark/Persona-Lab.git`. Implementation progress and actual verification results are tracked in `docs/PHASE_STATUS.md`; the targets below are not completion claims.

This plan incorporates the supplied product brief and the design discussion. Dates are target working days in India time, not evidence of completed work. Hackathon dates and submission requirements in the supplied brief remain to be independently confirmed.

## Scope

**MVP:** one fictional insurance scenario, Priya as the customer, adaptive text conversation, authoritative persisted state, immutable history, decision snapshots, independent branches, side-by-side comparison, evidence-linked evaluation, public demo, tests, documentation, and a three-minute demonstration video.

**Deferred:** voice/video calls, animated talking avatars, 3D environments, scenario-authoring UI, organizations, billing, team analytics, population percentiles, mobile apps, second scenario, and dark/light theme switching.

Counterfactual outcomes are generated simulations, not predictions. State indicators are simulation variables, not psychological measurements. All policy facts and customer information are fictional.

## Design contract

- Dark navy canvas, layered slate surfaces, soft white text, restrained violet actions, and teal alternative-branch accents.
- Human presence through an original or appropriately licensed fictional character portrait; reference screenshots guide composition and must not be copied as branded assets.
- Clear typography, generous spacing, readable solid conversation surfaces, subtle borders, and consistent component states.
- Three main experiences: scenario studio, practice workspace, and comparison workspace. Evaluation opens as a drawer or focused report; decision selection happens inside practice.
- Use reference image 6 for scenario hierarchy, images 9/12 for workspace focus, image 5 for timeline interaction, and image 8 for visual restraint.
- The signature interaction is selecting a decision and splitting the conversation into two visible paths. Motion supports orientation and respects reduced-motion preferences.
- No decorative scores, fabricated activity, unsupported emotion detection, or controls suggesting unavailable voice/video features.
- Every phase includes relevant loading, empty, error, keyboard, and responsive states. Visual QA is continuous.

## Phase 0 — Project foundation and dependency verification

**Target: Day 1, October 27**

- Establish a dedicated Git repository and project tooling without staging unrelated home-directory files.
- Scaffold Next.js App Router, TypeScript, Tailwind, shadcn/ui primitives, Lucide, Zod, Vitest, and Playwright.
- Configure native Node development, PostgreSQL, Prisma, environment validation, and a secret-free `.env.example`.
- Verify official participant documentation for Meta endpoint, model identifier, authentication, structured output support, limits, and access. Record verified details and unresolved inputs in integration documentation.
- Define a server-only provider interface and explicitly labelled mock mode. Missing live access must remain visible; never silently substitute another provider.
- Add lint, typecheck, unit-test, end-to-end-test, and build commands.

**Acceptance:** scaffold builds; database connection and initial migration work; environment errors are understandable; no credentials enter source control or client code. Record actual command results. Meta access is either verified or documented as a specific blocker.

## Phase 1 — Visual system and complete interface prototype

**Status: complete locally on October 27, 2026.** Acceptance evidence: [Phase 1 review](PHASE_1_ACCEPTANCE.md).

**Target: Days 1–2, October 27–28**

- Create color, typography, spacing, elevation, radius, focus, and motion tokens.
- Build navigation, buttons, badges, cards, portrait treatment, conversation messages, composer, drawer, and timeline primitives.
- Design the scenario studio with one flagship card and an honest empty/resume state.
- Prototype practice and comparison with explicitly labelled fixture data, including a shared history and a branch split.
- Define desktop composition and mobile behavior: collapsible context, accessible timeline list, and stacked comparison with branch switching.
- Review actual browser renders before expanding the component library.

**Acceptance:** the three experiences form a coherent visual system; primary actions are obvious; representative mobile and desktop layouts work; keyboard focus and reduced motion are supported. Prototype screens must not imply a functioning backend.

## Phase 2 — Persisted conversation vertical slice

**Status: complete locally with live Meta verification on October 27, 2026.** Acceptance evidence: [Phase 2 review](PHASE_2_ACCEPTANCE.md).

**Target: Days 2–3, October 28–29**

- Define versioned fictional policy facts, exclusions, objectives, character goals, private knowledge, constraints, and rubric.
- Implement Scenario, Character, Session, Branch, Message, Event, Snapshot, Evaluation, and turn-idempotency storage.
- Pin an immutable scenario definition and rule/rubric versions for each session; create the initial branch and initial snapshot together.
- Implement session creation and retrieval with scoped anonymous access using secure session credentials. Define retention, recovery limits, and session deletion behavior.
- Build a structured provider boundary: bounded context, schema validation, timeouts, recoverable errors, and server-only metadata.
- Connect scenario selection, chat, persistence, and resume to the interface.
- Wire the real Meta adapter only from verified documentation; exercise it as soon as access is available.

**Acceptance:** start a scenario, complete five turns, reload, and resume the same history. Unauthorized session access fails. Provider failure preserves the draft and does not create partial turns. Mock and live modes are visibly distinguished; mock success does not prove live integration.

## Phase 3 — Authoritative state and decision timeline

**Status: complete locally on October 27, 2026.** Acceptance evidence: [Phase 3 review](PHASE_3_ACCEPTANCE.md).

**Target: Days 3–4, October 29–30**

- Implement a deterministic state reducer with allowlisted transitions, bounds, and explicit knowledge-reveal events.
- Treat model deltas as proposals; reject or normalize invalid proposals under documented rules.
- Add fictional-policy checks for unsupported guarantees without claiming exhaustive natural-language compliance detection.
- Persist each accepted turn's messages, events, metadata, and snapshot atomically.
- Use database-enforced idempotency and optimistic concurrency so only one result can commit from a branch revision. Avoid holding a database transaction open during a provider call.
- Define decision boundaries precisely: an alternative trainee response starts from the snapshot immediately before the original response.
- Render ordered timeline markers, saved-state previews, and understandable simulated indicators.

**Acceptance:** tests demonstrate state bounds, knowledge isolation, ordered unique sequences, duplicate-request safety, stale-write rejection, and rollback on failed writes. Snapshots restore exact recorded state. Every evidence reference resolves to a stored record.

## Phase 4 — Rewind, independent branches, and comparison

**Status: complete locally on October 27, 2026.** Acceptance evidence: [Phase 4 review](PHASE_4_ACCEPTANCE.md).

**Target: Days 4–5, October 30–31**

- Create child branches linked to an immutable parent snapshot and the session's pinned scenario.
- Resolve shared prefix history with stable message/event IDs; store new turns only on the selected branch.
- Preserve character knowledge, context, and state at the fork boundary.
- Add decision preview, “Try another response,” branch naming, branch switching, and a restrained split transition.
- Build aligned transcripts with a shared-prefix section, divergence markers, and actual state/event differences.
- Clearly distinguish recorded trace replay from new model generation; do not promise reproducible generated dialogue.

**Acceptance:** a child starts from the exact selected pre-decision state; parent records remain unchanged after child turns; both branches share the correct prefix and can diverge independently. Comparison uses stored data and remains usable on mobile.

## Phase 5 — Evidence-grounded evaluation

**Status: complete locally on October 27, 2026.** Acceptance evidence: [Phase 5 review](PHASE_5_ACCEPTANCE.md).

**Target: Day 6, November 1**

- Implement the scenario rubric: factual accuracy/compliance 30%, needs discovery 20%, objection handling 20%, communication 15%, appropriate next step 15%.
- Document how each score is calculated and display “insufficient evidence” where appropriate.
- Prefer deterministic checks for known policy rules. Add a separate model judge only if necessary, with validated evidence IDs and clear limitations.
- Evaluate the full effective branch history; separately label findings arising after the fork. Persist evaluation versions and the evaluated branch revision so later turns cannot silently invalidate a displayed report.
- Add exact transcript/event links, strengths, specific improvements, and a useful next practice action.
- Compare rubric results without claiming real-world causality or guaranteed improvement.

**Acceptance:** unsupported guarantees are flagged with actual evidence; fabricated or inaccessible evidence IDs are rejected; scores follow documented rules; reports identify their scope and revision. Appropriate refusal or follow-up can count as success.

## Phase 6 — Complete journey, visual refinement, and accessibility

**Status: visual implementation and local acceptance complete October 27, 2026.** [Acceptance evidence and remaining native/device checks](PHASE_6_ACCEPTANCE.md).

**Target: Day 7, November 2**

- Refine scenario introduction, character presence, conversation readability, timeline selection, branching transition, and report layout.
- Complete draft recovery, loading, retry, expired-session, empty-history, and database/provider failure experiences.
- Test keyboard navigation, focus restoration, announcements, contrast, zoom, reduced motion, and narrow layouts.
- Optimize fonts and portrait assets; avoid layout shifts and unnecessary animation.
- Run a timed rehearsal: questionable response → grounded issue → fork → better alternative → comparison.

**Acceptance:** the complete journey is understandable without explanation; no dead controls or placeholder analytics remain; representative desktop/mobile browser screenshots pass visual review; the signature branch interaction is clear and responsive.

## Phase 7 — Release validation and public deployment

**Target: Day 8, November 3**

- Run lint, typecheck, unit/integration tests, Playwright journeys, migration checks, and production build.
- Cover persistence, authorization, provider failure, concurrency, invalid model output, fork isolation, comparison accuracy, and evaluation references.
- Choose a Node-compatible host and managed PostgreSQL; configure secrets, migrations, HTTPS, session security, usage limits, and safe logs.
- Apply session deletion/retention behavior and prevent private knowledge or credentials from entering public API responses.
- Document setup, architecture, mock/live operation, limitations, license, and verified Meta configuration.
- Validate the deployed application through a real browser with live Meta responses, reload/resume, fork, comparison, and evidence inspection.

**Acceptance:** public deployment passes the full journey and access checks. Local tests are reported separately from deployed verification. Publish the source repository after checking secrets and asset rights. Any unavailable integration is disclosed prominently.

## Phase 8 — Demonstration and submission package

**Target: Day 9, November 4**

- Confirm current organizer requirements, registered theme, deadline, and permitted submission edits.
- Record a three-minute demonstration using fictional data and actual working behavior.
- Explain Meta's role, the saved-state fork, parent isolation, alternative conversation, and evidence-linked feedback.
- Provide public source, demo URL, setup instructions, limitations, and video.
- Recheck the deployed journey and freeze nonessential changes before submission.

**Acceptance:** submission materials accurately match the deployed build; all required links work; the video fits the permitted duration. Submit only through the authorized organizer workflow and report confirmed submission separately from preparation.

## Engineering rules across phases

- Keep the official name PERSONA LAB throughout visible product copy.
- Commit coherent increments in the dedicated project repository; never include secrets or unrelated files.
- Maintain a short phase-status record with completed work, commands actually run, blockers, and next actions.
- Use scenario/rule/context versions to keep saved sessions interpretable after code changes.
- Keep private character knowledge server-side and authorize access to every branch, snapshot, comparison, and evaluation.
- Store operational provider metadata safely; do not request or expose hidden model reasoning.
- Review designs and behavior together. Attractive fixture screens do not prove simulation correctness.

## Dependencies and scope cuts

Live Meta access, PostgreSQL availability, original/licensed imagery, hosting, and organizer requirements must be resolved early. A missing provider credential blocks live acceptance but does not block mock-based domain development.

If the schedule slips, cut optional model judging, decorative animation, extra charts, and secondary portrait treatments first. Preserve persistence, access control, state consistency, branch isolation, accurate comparison, evidence, and clear integration disclosure.

## Release definition of done

- [ ] One cohesive, polished scenario-to-comparison journey.
- [ ] Five-turn persisted conversation and successful reload/resume.
- [ ] Verified live Meta use for the core character, or explicit incomplete-integration disclosure.
- [ ] Validated state changes and transactionally consistent turns.
- [ ] Exact pre-decision fork with parent isolation and shared prefix.
- [ ] Accurate comparison with evidence-linked evaluation.
- [ ] Relevant automated checks pass with recorded results.
- [ ] Responsive/accessibility review completed.
- [ ] Public deployment independently verified.
- [ ] Public source, README, license, and three-minute demonstration prepared.
- [ ] Organizer requirements confirmed and submission status recorded.
