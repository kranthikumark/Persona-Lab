# Phase 6 follow-up review — October 28, 2026

Software findings were fixed and verified on localhost. The user agreed to perform the human/device checks; results have not yet been received. **The manual checklist is still open.** Automated browser checks are recorded separately below.

## Findings addressed

| Finding                                                        | Change and evidence                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every route inherited the same title                           | Studio, History, Practice and Comparison now have distinct page titles. The regression test follows actual History navigation and opens both conversation routes in all three engines.                                                                                                                                                                             |
| Sending from the keyboard dropped composer focus               | The composer stays read-only while waiting, exposes form busy state, and retains focus. Submission through the Send button restores focus to the composer only when focus was lost to the document; it does not interrupt someone who moved to another control. Both Enter submission paths and Shift+Enter are checked.                                           |
| WebKit pointer-opened dialogs lost their return target         | Brief, Evaluation, rewind and timeline buttons explicitly focus their opener before showing the dialog. Escape restores the actual invoking button; evidence links still transfer focus to the referenced message.                                                                                                                                                 |
| HTTP phone review lacked `crypto.randomUUID`                   | Retry keys use the browser's cryptographic `getRandomValues` fallback when randomUUID is absent. The unit test checks UUID format/version/variant; the cross-engine test removes randomUUID and submits actual mock turns. No weak random-number fallback was added.                                                                                               |
| Repeated automated runs interfered with manual usage admission | Development mock test servers now use a per-run counter namespace. Production and live mode ignore this test-only override. Existing counters initialized with a local-time offset have their remaining expiry bounded to the intended UTC window without resetting usage counts. A database regression checks real window duration against the application clock. |

The temporary phone server uses a dedicated `.next-phone` generated directory, ignored by Git and ESLint, so the browser suite and phone review can run independently. Existing `.env` and live-provider settings were not changed.

## Completed software verification

- **24 cross-engine checks passed:** eight each in installed Chrome, Firefox and Playwright WebKit. They cover page titles, composer focus, keyboard rehearsal, dialog focus, evidence navigation, rewind/alternative/comparison, 320px reflow, larger text, reduced motion, forced-colors emulation, error/draft recovery and expired/unavailable states.
- **48 unit tests and 26 PostgreSQL integration tests passed.**
- The complete standard Chrome suite also passed all **21 tests in 55.6 seconds**. These overlap with the Chrome acceptance cases above; they are not an additional 21 unique behaviors.
- Lint, typecheck, production build and the 16-file client privacy/configuration scan passed. All four migrations are applied.
- Representative WebKit 320px practice and Firefox evaluation captures were visually reviewed. Captures and structured checks are in `screenshots/phase-6-followup/` and `verification/phase-6-followup/`.
- The first tests exposed the title/focus defects. Further initial failures included a desktop navigation selector, equivalent animation-duration serialization across engines, macOS WebKit link-navigation behavior, and the shared creation cap. These were diagnosed; the final cross-engine run passed in full.

On macOS, the WebKit keyboard rehearsal uses Option-Tab for link navigation. This follows [Apple's documented Safari keyboard behavior](https://support.apple.com/en-gb/guide/safari/cpsh003/mac); native Safari and its user settings still require a human check. WebKit automation is not a claim of testing the Safari application or an iPhone.

## Human acceptance — awaiting results

| Check                                | Steps and expected outcome                                                                                                                                                                                                                                                                                                                                                                        | Current result                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Native 200% and 400% zoom            | Set the browser's actual zoom percentage. Traverse Studio, Practice, rewind, Evaluation and Comparison. Every control remains reachable; text is readable without content loss. Smaller responsive layouts and vertical scrolling are expected. Restore the original zoom afterward.                                                                                                              | Awaiting user                       |
| Audible VoiceOver                    | Enable VoiceOver through macOS Accessibility settings. Navigate the journey and verify page identities, button/control names, new replies, progress/error announcements, dialog entry/exit and evidence focus.                                                                                                                                                                                    | Awaiting user                       |
| Physical phone                       | On the same Wi-Fi, open the temporary mock link below. Check touch controls, scrolling, the on-screen keyboard, portrait, transcript, rewind, evaluation and comparison. Record device, OS and browser.                                                                                                                                                                                           | Awaiting user                       |
| Human rehearsal                      | Start timing before Begin practice. Send `All claims are guaranteed.`, inspect Evaluation and follow its evidence. Rewind before that response, name an alternative, send `Claims are reviewed, not guaranteed. Let's review exclusions and waiting periods.`, then compare. Explain which evidence belongs to each path and whether the original was preserved. Record time and confusing steps. | Awaiting user                       |
| Native Safari / other phone platform | Repeat representative navigation in actual Safari; obtain iOS and Android results when devices are available. Firefox engine automation is recorded above; human browser review remains separate.                                                                                                                                                                                                 | Awaiting user / device availability |

## Review links

- Existing production copy in Meta mode: `http://127.0.0.1:3100/`. Model conversation requests use the configured provider.
- Temporary scripted mock review: `http://192.168.1.7:3104/`. This works on the computer or a phone on the same Wi-Fi. It makes no Meta requests. The LAN address can change when the computer changes networks.

Refresh the review page before testing to pick up the fixes. Use fictional content. Keep the phone server available until the user finishes, then stop its port-3104 process and remove only its regenerable output if desired. No AWS setup was changed.

To rerun the automated review:

```sh
PERSONA_ACCEPTANCE_REVIEW=1 npx playwright test --config playwright.acceptance.config.ts
```

If reviewer feedback identifies a defect, fix it and rerun the affected acceptance check before marking that row passed. Do not replace missing human evidence with automation timing or viewport emulation.
