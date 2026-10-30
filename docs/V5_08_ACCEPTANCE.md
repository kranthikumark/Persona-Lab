# V5-08 — Meta speech transcription and microphone consent

Implemented and accepted locally for the English microphone/device-playback check on October 30, 2026. The user explicitly selected Meta Muse Voice Transcribe and authorized reuse of the existing ignored `.env` Meta key. No new key or speech provider was provisioned. Meta remains the character conversation provider.

## Scope and current gate

This phase supplies a separate English microphone/transcription acceptance room, linked from an English practice when localhost acceptance preview is active. The original V5-08 diagnostic room is available at `/sessions/SESSION_ID/speech-check`. Routine practice now uses the [inline Speak response flow](V5_09_DICTATION.md) above its response box. English microphone acceptance is independent of the Hindi/Telugu language-preview flag. `npm run dev:locales` remains available for native-language text preview. Set `PERSONA_SPEECH_ACCEPTANCE=false` to disable the local microphone check.

A complete spoken conversation and speaking avatar remain V5-09. The global voice capability stays unavailable. Hindi/Telugu speech and application streaming remain unavailable until separately verified. Native-language text approval and target-reader acceptance from V5-05/06 remain pending independently.

## Actual provider verification

The existing key returned HTTP 200 from `POST https://api.meta.ai/v1/asr/transcribe` with `muse-voice-transcribe-1.0`. A synthetic English WAV recording asked about monthly budget and stated the ₹1,250 amount. Both were recognized. This proves account/API access for this fixture; it is not a human microphone, accent-quality or listening pass.

A second call exercised the owned localhost application endpoint and the real Meta adapter. It recognized the budget question and amount, returned a 3,840ms provider duration, and took about 6.5 seconds at the provider / 7.1 seconds through the application. One finite observation is not a latency guarantee. The before/after session view was identical: revision zero, one opening message, no committed speech turn. See `verification/v5-08/live-meta.json`; no key, private transcript or user-session ID is published there.

| Capability | Meta documents | Application evidence / release state |
| --- | --- | --- |
| English file STT | Supported | Synthetic fixture and real owned localhost endpoint passed; microphone operation passed by user report |
| Hindi/Telugu STT | Listed among supported languages | Not verified in this application; disabled |
| Code-switching | Supported by provider | Not verified locally; no product support claim |
| Streaming / partials | Realtime WebSocket and file SSE | Not implemented in this phase; buffered final transcript only |
| Turn timing | Turn-level timing; no word-level timing/confidence | Uses bounded provider audio duration and measured processing latency; no pronunciation/confidence score |
| TTS / speech-to-speech | Muse Voice Transcribe does not provide either | No Meta TTS claim; optional installed-device English readback is separately labeled |
| Device playback | Browser/OS capability | Only voices marked `localService: true` are offered; automated behavior tested, audible, clear playback passed by user report |
| Audio storage | Provider/account policy applies | Application does not write audio or check transcripts to disk/DB; organization ZDR not established |

Source: [Meta speech guide](https://dev.meta.ai/docs/speech-to-text), [file API reference](https://dev.meta.ai/docs/api-reference/voice/transcribe), [model overview](https://dev.meta.ai/docs/overview), [voice schemas](https://dev.meta.ai/docs/api-reference/voice/schemas).

## Cost, data handling and provider boundaries

Meta documents $0.18 per processed audio hour, with whole-second billing and equal streaming/non-streaming rates. This is the documented price as checked October 30, not a billing-dashboard verification or contractual quote. The application limits recordings to 60 seconds, 20 transcription attempts per browser owner per hour, 80 globally per hour and two concurrent provider jobs per application process. There are no automatic retries.

Reuse of the existing key is subject to the user's existing [Meta AI Developer Legal Center](https://dev.meta.ai/legal). No open-weight model, voice asset or additional licensed SDK was downloaded. Device voice availability/licensing is supplied by the installed OS/browser; the app does not package or redistribute those voices.

Meta states that ZDR requires separate organization enablement and is not standard usage. We did not establish ZDR on this account. The consent copy distinguishes application memory-only handling from provider retention and processing. This phase does not promise provider deletion or zero retention. See [Meta ZDR policy](https://dev.meta.ai/help/policies-and-privacy/zero-data-retention).

## Consent and audio lifecycle

- Opening a room never requests a microphone or starts playback. An unchecked consent box keeps Start disabled. No camera stream is requested.
- Consent explicitly covers capture and Meta transcription when selected, with application retention fixed to ephemeral and camera analysis false. It expires after 15 minutes. Server validation rejects missing, expired, future, expanded-purpose or retention/analysis-altered consent.
- Capture uses a self-hosted AudioWorklet and mono 16-bit PCM WAV encoding. Web Audio handles source sampling; unusual context rates are downsampled to 24kHz. No new codecs or media binaries run server-side. A clip is limited to 60 seconds and approximately 2.9MB; the server checks RIFF structure, format, channel count, sample rate and actual duration.
- Stop ends every track and closes the audio context. It retains a clip only in this room's memory for local listening and optional upload. Upload occurs only after **Transcribe with Meta**.
- Cancel/revoke/discard, page hide, page exit, route unmount, device disconnect and a late permission grant after cancellation stop capture and discard pending material. Object URLs are revoked, pending fetch is aborted, and a request token prevents late responses from repopulating the transcript. Aborting a network request is best effort; it does not guarantee that Meta has not already processed or billed uploaded audio.
- Confirmation requires an editable, nonempty transcript within the shared 70-word/2,000-character bounds. Editing after confirmation requires confirmation again. Confirmation creates no authoritative conversation turn; V5-09 will integrate confirmed speech with source metadata and normal turn admission.
- Device playback is manual, English-only and limited to voices the browser marks local. Remote voices are excluded. Edit, capture start, discard, revoke, hide and exit stop playback. Original-recording playback stays local. See [MDN localService](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService).
- The room does not store an audio file, transcript, media object or speech source in PostgreSQL. Only the existing bounded admission counters are updated. The browser's existing text draft is neither overwritten nor erased.

## Permissions and request boundaries

The global Permissions-Policy continues blocking microphone and camera. The initial V5-08 slice permitted microphone only on `/sessions/:id/speech-check`; the subsequent [chat dictation slice](V5_09_DICTATION.md) also permits it on the practice document `/sessions/:id`, with camera still blocked. The standalone check uses full-document navigation. Chat dictation reloads the practice document only when the inherited document policy blocks microphone. Automated checks verify document policy headers; practice now supports opt-in capture as well. [Next.js installed header documentation](../node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md) was read before implementation.

The transcription endpoint checks exact origin, browser ownership, current branch revision, English locale, localhost preview and current consent before provider admission. Streamed body bounds apply even without trustworthy Content-Length. Provider credentials remain server-only; redirects are rejected, provider errors are sanitized, response size is bounded and requests have a 45-second provider deadline. After processing, ownership and revision are checked again; stale results are rejected. No application audio URL, remote URL transcription, retained upload or arbitrary-provider endpoint is accepted.

## User-reported acceptance

On October 30, 2026, the user directly reported “microphone testing worked.” Record microphone operation as a **user-reported pass**. The user subsequently confirmed “Yes, playback was clear.” Record audible and clear playback as a **user-reported pass**. Device/browser details, transcript accuracy and stop/return behavior were not supplied; do not infer detailed passes from the short report. The local English microphone and device-playback check is accepted. The following checklist documents how to reproduce it; unreported details are not invented as individual passes:

1. Open an English practice and choose **Microphone check**.
2. Verify that opening alone does not activate the microphone. Agree, start recording, speak a short English sentence with a rupee amount, then stop.
3. Confirm the device indicator turns off. Listen to the original clip, then transcribe.
4. Correct any words or numbers. Confirm the transcript. If a local English voice is offered, use readback and stop playback.
5. Revoke consent or leave the room; confirm recording/playback stops. Return to text and verify an existing draft is preserved.
6. Report accuracy, audible output, permission behavior and device/browser. These results gate human acceptance; existing earlier text/phone/VoiceOver passes do not cover the microphone feature.

Microphone capture requires HTTPS or a trusted localhost origin; plain LAN HTTP is not a phone microphone acceptance environment. No AWS/HTTPS deployment or physical-phone microphone pass is claimed.

## Software verification results

126 unit tests, 53 PostgreSQL integration tests and 49 unique browser checks passed (37 English, six Hindi/Telugu text/export regressions, six speech-room checks). The three catalog publication tests remain deliberately skipped by the ordinary database suite; V5-07 records their dedicated disposable-database acceptance. Both final speech theme/visual checks also passed on repeat. Lint, TypeScript, production build and client privacy checks passed. All four new desktop/phone light/dark screenshots were inspected; reflow passed down to 320px and automated speech-room accessibility reported zero violations.

Synthetic browser capture exercises the real AudioWorklet with fake browser input; transcription and device speech are mocked in that suite. It checks consent, 70/71-word confirmation, local-only voice selection, stop/cancel (including a cancellation callback), late permission grants, hidden-page cleanup, late responses, real document policy headers, owner/origin boundaries and recovery of the original typed draft. Only the separately recorded live provider evidence establishes actual Meta access. See `verification/v5-08/acceptance.json`.

## Microphone visibility correction — October 30

The microphone entry was previously hidden when the server started with ordinary `npm run dev`, because speech acceptance incorrectly depended on the language-preview flag. English speech acceptance now defaults on only for configured, non-production loopback origins and can be explicitly disabled with `PERSONA_SPEECH_ACCEPTANCE=false`. The independent native-language and full-voice gates stay unchanged. The practice header shows a microphone icon button beside Policy brief and wraps its actions on narrow screens.

Verification without the language-preview flag: six focused unit tests, three speech database integration tests and six microphone browser checks passed. The real localhost UI showed the button at 1440, 390 and 320px with comparison controls present, opened the room and kept recording disabled before consent. See `verification/v5-08/microphone-visibility.json`. Microphone operation and clear, audible playback subsequently passed by direct user reports.
