# Session report cards

Implemented October 28, 2026. Open **Field notes** in any practice session, or expand **Rubric evaluation** for a path in comparison. The card is created automatically on first opening. Refresh it after more responses using **Evaluate current revision**. Generation uses recorded dialogue and events; it makes no model request.

Every valid session receives a numeric practice score, including empty and partial sessions. A new session starts at **0/100, Not started**; that is a progress baseline, not a judgment of ability.

The card includes:

- **Positives** supported by links to actual trainee responses.
- **Needs attention** for matched concerns, separately from unrecognized or missing evidence.
- **What to improve**, prioritizing observed concerns, then evidence gaps.
- Five category scores with progress bars, evidence details, and a next practice action.
- Revision and scope information, including shared and post-fork evidence. Older revision cards remain marked outdated.

## Current scoring (v3)

| Category | Weight | Quality checks |
| --- | ---: | --- |
| Factual accuracy / compliance | 30% | Claim boundaries; checked fictional terms |
| Needs discovery | 20% | Budget; prior experience or concerns |
| Objection handling | 20% | Acknowledgement; checked limits |
| Communication | 15% | Collaborative language |
| Appropriate next step | 15% | Review or reasoned pause; unpressured choice |

The current rubric has nine quality checks. Category points are demonstrated checks divided by that category's check count, multiplied by 100. The overall score is the rounded weighted sum. Concerns and missing evidence earn zero; a concern still counts toward evidence coverage. A greeting with no recognized quality evidence scores 0/100, 0/9 assessed. Length compliance awards no quality points.

New submissions must contain 1–70 words. The composer shows a shared browser/server counter, and the API rejects invalid new input before provider admission or writes. Reports include a separate response-length section. Historical responses are preserved and labeled accepted before the rule. See [V5-02 admission and scoring](V5_02_ACCEPTANCE.md).

Historical v2 examples remain valid for their saved reports: a short greeting scored 8/100 from its length check, and a complete conversation with length as its only concern scored 93/100. Those are previous-version calculations, not the current quality formula.

Partial coverage is labeled **Provisional**. Missing matches are not presented as observed negative behavior. If nothing negative is matched, the card says so instead of inventing criticism. If nothing positive is matched, it asks the learner to record a response instead of inventing praise.

## Language and versioning

`insurance-rubric-v3` / `quality-report-v3` uses the bounded English quality phrase checks from v2, with length removed from scoring. It remains a limited rubric, not unrestricted semantic understanding or a measure of empathy or real-world competence.

Frozen v1/v2 evaluators retain their saved scores and validators. Existing v2 cards display their original result; refreshing writes a separate v3 record. Opening a v1 legacy card creates a separate current numeric card. No existing report, transcript or snapshot is rewritten. Exports identify the displayed report to preserve its rubric version and score. Historical pinned scenario facts and weights must match supported evaluation contracts.

## Verification

- Unit cases cover numeric scores for no/partial evidence, the missed real-session wording, concern precedence, fixed weights, forged evidence rejection, and legacy validation.
- PostgreSQL tests cover persistence, overlapping requests, stale revisions, owner isolation, shared/fork evidence, corrupt evidence, and upgrading v1 without rewriting it.
- Browser cases cover automatic report creation, empty/partial scores, positives/concerns/improvements, persistence, stale refresh, evidence focus, both themes, 320px/desktop reflow and selected accessibility rules.

Human VoiceOver, native zoom and physical-device acceptance remain separate pending checks in the Phase 6 manual review. Automated browser checks do not replace them.

### Local results, October 28, 2026

- 54 unit tests and 27 PostgreSQL integration tests passed.
- The complete Chrome browser suite passed all 28 tests in approximately 1.3 minutes.
- Six dedicated report-card checks passed across Chrome, Firefox and WebKit (both themes).
- Lint, type checking, production build, release configuration and client privacy checks passed.
- Evaluation browser captures and saved test report payloads are in `docs/screenshots/report-card/` and `docs/verification/report-card/`. Phase 1–7 historical captures remain unchanged.
- The reviewed 15-turn localhost conversation received a separate v2 report: 93/100, with ten checks recognized and response length as the remaining concern. Its v1 report and conversation were preserved. No live model request was needed to create the report.

## PDF Word and sharing

Use **Download PDF** or **Download Word** in Field notes. Both formats contain the score summary, category breakdown, positives, observed concerns, improvement plan, revision scope and selected evidence excerpts. PDF uses locally embedded Noto Sans fonts. Word is editable. Files are generated on demand from the authorized, current revision; no public file storage or session-access link is created. Refresh an outdated report before exporting.

**Share report** provides an attachment format selector and a prepare button. Once the file is ready, **Open share options** invokes the device share sheet in a fresh click. Choose an installed email or WhatsApp target and confirm sending there. Availability depends on the browser, device, permissions and installed apps; a share-sheet success is not proof of recipient delivery. See [Web Share API behavior](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share).

**Email summary** opens an email draft. **WhatsApp summary** opens a prefilled message, following [WhatsApp's documented sharing link format](https://faq.whatsapp.com/425247423114725/). These links contain text only; they do not attach files. Download and attach the PDF or Word document manually when native file sharing is unavailable. No mail-server or WhatsApp Business credentials are required for these user-controlled flows. Automatic server-side sending is not configured.

Exports require the browser's existing session ownership and a matching application origin. Foreign owners receive 404, foreign origins 403, malformed inputs 400 and outdated revisions 409. Export responses are private and not cached. Evidence excerpts exclude owner tokens, branch/message access identifiers and unrelated conversation history. Generated local examples are ignored by Git under `output/reports/`.

Export acceptance on October 28: 55 unit tests passed; nine targeted browser checks passed for report cards, keyboard/reflow/accessibility and export/sharing behavior. A final export regression passed after layout revisions. Production build, lint, TypeScript and client privacy checks passed, and the export route's production trace includes the bundled font assets. The reviewed session's final five-page PDF and four-page Word report were rendered and every page visually inspected. Native share behavior was stubbed for software testing; actual email/WhatsApp delivery on a physical device remains user acceptance, not a claimed automated result.


### User acceptance update

On October 28 the user reported the VoiceOver, native zoom, physical-phone and sharing checks complete and working. These are user-reported passes; no device inventory, recipient identity or automated delivery proof is implied. The V5 plan introduces new locale/media acceptance separately and keeps the existing Phase 8 demo/submission deferred.
