# V5-09 — spoken replies and native-language voice preview

Implemented October 30, 2026. Local implementation and provider checks are distinct from human language/device acceptance.

## Practice flow

- Select **Auto speak replies off** to enable spoken replies for this practice path. The latest reply plays immediately, and each new AI reply plays once after it has been saved. **Stop reply** interrupts playback; **Replay reply** repeats the latest reply. Turning Auto speak off cancels playback. This setting starts off after reload or changing paths, so saved history never speaks unexpectedly.
- Playback uses only an installed browser/device voice matching the practice language, preferring the exact region. The app never substitutes English for Hindi/Telugu or uses a remote voice. A missing matching voice disables playback and explains how to install one; chat stays usable.
- Beginning microphone capture stops spoken replies before requesting microphone access. Sending a turn, hiding/leaving the page, changing paths, or unmounting also stops playback. Playback errors offer Replay/readable text. Playback has a 90-second cap. No new service credentials, TTS provider, audio retention, autoplay on page load, or camera access is introduced.
- **Speak response → Stop recording → edit transcript → Send** works in English, Hindi and Telugu in configured localhost language acceptance preview. Existing typed text is preserved. The first app microphone approval remains remembered under the same Meta/purpose/retention terms.
- Native speech uses the session's pinned practice language. Meta receives a Hindi or Telugu language bias. Signed receipts bind that locale alongside owner, branch, revision, raw text and consent. Submitting a receipt under another locale fails before conversation generation. Reviewed text remains in its original script in history and reports.

## Start and test on localhost

Run `npm run dev:locales` and open http://127.0.0.1:3100/. Hindi/Telugu selectors are available in this explicit local preview. Select a language **before beginning a new practice**; existing sessions retain their original language. Production/native release gates remain closed pending fluent review. English dictation does not require the locale-preview flag.

The older standalone `/sessions/ID/speech-check` diagnostic remains English-only; use the inline practice composer for these new native checks.

For each language, record the browser/OS/device and test:

1. Enable Auto speak replies. Confirm the voice reads the selected language clearly; test Stop and Replay. If no voice is installed, record that limitation and install a matching device voice before audible acceptance.
2. Speak a short question about the monthly budget. Stop, check spelling/numbers, edit as needed, then Send. Confirm the saved message matches the final reviewed text.
3. Confirm Priya's new saved reply plays once. Start recording during playback and confirm it stops, with no spoken reply captured as microphone input.
4. Cancel a recording with typed text already present; confirm it survives. Reload and switch paths; confirm speech stops and history does not automatically replay.
5. Confirm repeated recording does not ask for app approval again. Browser/OS permission remains controlled separately.

On October 30 the user offered to arrange tests for all three languages. Results for this new spoken-reply/native slice are **pending**, not approved. Earlier English dictation and diagnostic acceptance remain recorded separately.

## Verification

- 134 unit checks passed, including exact-language/local-only voice selection, native provider bias, locale-bound receipt mismatch and unchanged English behavior.
- Eight targeted database checks passed: English and native ASR admission, ownership/consent/revision guards, native reviewed voice commit and original-script persistence, idempotent voice turn behavior.
- 17 unique browser checks passed across full/focused runs: 15 in the full run plus the two native dictation checks after correcting their expectation to preserve final trailing whitespace. Browser audio, ASR and spoken voices are synthetic/mocked. The initial playback mock used plain objects with the native utterance class; it was corrected to mock the utterance boundary as well. This does not establish audible output.
- New browser checks cover opt-in playback, latest reply once, stop/replay, recording interruption, no history replay, matching language in all three locales, missing Telugu voice fallback, and native transcript edit/send/reload. Existing inline and diagnostic checks remain green.
- TypeScript, lint, production build and client privacy results are recorded in `docs/verification/v5-09/spoken-replies.json`.

## Live Meta sample evidence and limits

See `docs/verification/v5-09/native-speech-live.json`. One public read-speech sample per language from [Google FLEURS](https://huggingface.co/datasets/google/fleurs), licensed CC BY 4.0, was resampled to mono 24 kHz PCM WAV and processed with Meta Muse Voice Transcribe. Only the first selected WAV was streamed from each archive (under 1 MB of archive data per language); full datasets were not downloaded. Audio and reference metadata remain temporary test files outside the repo, and public evidence contains digests/counts rather than transcript text.

- Hindi: 12.24 seconds, 3 normalized word edits out of 30 reference words (10%).
- Telugu: 10.98 seconds, 2 edits out of 19 reference words (10.53%).

These demonstrate live API access and native-script output on those samples, with recognition differences. They are not an accuracy benchmark, dialect/noise/code-switch acceptance, real microphone acceptance, or fluent review. The macOS installed voice inventory included Hindi (Lekha) and no Telugu voice; browser/device voice availability is checked at runtime.

The replay script `scripts/verify-native-speech-live.ts --consent-meta-processing` expects the selected fixtures `/tmp/persona-{hi-IN,te-IN}-24k.wav` and reference metadata `/tmp/persona-{hi_in,te_in}-reference.json` (fields `source`, `filename`, `row`, with normalized reference in `row[3]`). It uses the existing ignored `.env` Meta key and prints only bounded metrics/digests.

Meta documents Hindi/Telugu support and language bias in its [speech-to-text guide](https://dev.meta.ai/docs/speech-to-text). Language bias is a hint, not guaranteed output-language detection. Meta TTS, streaming voice conversation, 2D speaking avatar, and production native release remain separate work.

## User playback acceptance — October 30, 2026

The user reported that Auto speak replies and Replay work well in Hindi and Telugu. Record those four playback checks as user-reported passes. Device/browser details were not supplied. Hindi/Telugu real microphone transcription, recording interruption, and the new English automatic-reply flow remain pending; this report does not approve translation content or production native release.

## User dictation acceptance — October 30, 2026

Following the Hindi/Telugu playback acceptance, the user confirmed the requested Speak response → Stop → edit → Send flow also works. Record Hindi/Telugu microphone transcription and reviewed submission as user-reported passes in this context. Exact device/browser details and quantitative transcript accuracy were not supplied. Starting microphone capture during AI playback remains an unconfirmed human check. Translation-content approval and production release are separate.

## User interruption acceptance — October 30, 2026

The user confirmed starting recording while Priya was speaking stopped her playback. This completes the requested localhost Hindi/Telugu voice acceptance checks by user report: Auto speak, Replay, Speak response → Stop → edit → Send, and interruption. The interruption confirmation did not supply a separate locale/device breakdown. Prior pending statements above describe earlier checkpoints and are superseded by these user reports. New English automatic playback, fluent translation-content approval, platform inventory, avatar/streaming and production release remain separate from this acceptance.
