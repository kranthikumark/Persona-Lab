# V5-09 first slice — speech dictation in the practice chat

Implemented October 30, 2026 in response to the request for microphone → transcribe → send in the actual practice. This is the dictation slice of V5-09. Automatic character readback, the speaking 2D avatar, streaming and full spoken-conversation acceptance remain separate pending work.

## User flow

The practice composer is now fully inline. Click **Speak response**, speak, then **Stop recording**. Stop automatically transcribes with Meta and appends the recognized words to the existing response box. Edit normally and click **Send response**. There is no recording drawer, separate transcript editor, Use/Replace step or separate Transcribe action in normal practice.

The first use presents a short inline Meta-processing explanation and **Allow and speak**. Approval is remembered in this browser (a versioned provider/purpose preference, containing no audio or transcript). Later clicks record directly, including after sending, switching paths or reloading. **Voice settings → Turn off voice input** removes the preference and cancels pending capture/processing. Browser/OS microphone permission remains controlled by the browser. If browser storage is blocked, the app retains the choice for the current tab. New provider/purpose/retention terms require a new preference version rather than silently extending approval.

Every new recording click under that remembered choice creates fresh, bounded processing consent for the existing server receipt checks. The backend consent lifetime and signature rules are unchanged. Remembering the UI choice does not enable production voice, native-language speech or any camera/retention feature.

Recording, elapsed time, Stop, Cancel and transcription progress appear beside Speak response. While capture/transcription is active, Send is disabled; typing stays available. Recognized words append to the latest draft, including edits made while the request was in flight. Atomic browser-storage updates roll back if the transcript cannot be stored. Cancel, hidden pages, permission denial, device interruption and late responses do not overwrite the existing draft. Temporary failures offer an inline retry without another approval prompt.

The response box remains the only transcript editor. The shared 70-word and 2,000-character limits apply before Send. Appending can exceed the limit; the normal counter asks for edits and Send stays disabled. No quality weight or pronunciation score changes. Speech controls never submit the form automatically.

Original audio stays in application memory and is discarded after insertion or cancellation. Stopping (or reaching the displayed 60-second limit) is the approved action that uploads the clip. The resulting text and short-lived receipt are saved with the existing browser draft; only Send makes the reviewed text authoritative. Raw source metadata describes the latest recognized recording; the final reviewed response can also contain earlier draft text or edits. The **Use keyboard text** fallback appears only when an uncommitted voice receipt cannot be used, retaining the words while clearing voice provenance.

English practice no longer shows the extra language-keyboard helper, and the separate microphone diagnostic button has been removed from its header. Hindi/Telugu keyboard guidance and the standalone diagnostic route remain available in their existing scopes. Beginning/resuming a practice uses document navigation so microphone policy is applied on entry, avoiding a second navigation in the normal recording flow.

## Server and history

Successful transcription can issue a signed, short-lived receipt tied to the browser owner, exact branch/revision, original recognition, model, duration and consent. The fixed existing server-only Meta key signs domain-separated HMAC-SHA256 data; the key is never included in the receipt. A changed key invalidates uncommitted receipts; server restarts with the same key preserve them. Raw recognition over 2,000 characters is still supported in the diagnostic room, but is not issued a chat receipt; the chat asks for a shorter recording.

The normal turn endpoint accepts `inputModality: voice` only with a matching unexpired receipt and only for configured localhost English dictation. Missing/forged/foreign-owner/foreign-path/expired receipts fail before character generation. Committed retry lookup still runs first, so a committed voice request can replay without revalidating an expired or rotated receipt. The input hash includes voice provenance, preventing a typed key from being repurposed as a voice request.

Normal response validation, state rules, generation admission and atomic branch revision/message/event/snapshot writes apply. Original recognized text and reviewed final text are preserved separately in voice source metadata, including explicit review and consent provenance. Audio bytes and the authentication receipt are not stored in PostgreSQL. No database migration is required; fields extend the existing JSON metadata contract. Existing typed hashes, sources and histories retain their behavior.

A voice receipt cannot move to another path. Changing branches/revisions tears down the recorder. Failed requests preserve the draft and retry key. The final reviewed text alone is sent to the character model; original recognition and consent metadata are not copied into the model's conversation history. Existing fork, reload, report and cleanup behavior applies to the saved voice message. Saved responses show **Voice, reviewed**.

The existing JSON reader retains its 12KB default for other endpoints; the turn endpoint has an explicit streamed 32KiB cap to accommodate the signed transcript alongside the final response. Individual text and receipt schema bounds still apply.

## Document permissions

The practice document and the dedicated diagnostic room permit same-origin microphone access while camera access remains blocked. Other routes retain the default microphone block. If practice was entered through a client-side transition from a document that blocks microphone, Speak response performs a full document navigation, recovers the saved draft, and opens the review dialog. The one-time microphone query marker is removed afterward. Consent is still required before any capture. This handles document-level Permissions-Policy without weakening the global policy.

## Verification and boundaries

- Unit and PostgreSQL integration coverage includes receipt owner/path/revision binding, tampering, expiry, key rotation, reviewed corrections, shared word limits, atomic voice commit, preserved raw source, idempotent replay, fork isolation and report generation.
- Browser coverage exercises actual AudioWorklet capture with synthetic browser audio, mocked ASR and a known synthetic signing key. It verifies review/edit/use/send, a 71-word rejection, preservation of an existing draft, cancellation, draft recovery across reload and persisted voice labeling in both themes. These tests do not use live credentials.
- A separate localhost test used synthesized English audio with real Meta transcription and a real Meta character response. Both endpoints returned HTTP 200, the saved source was voice, original/final text survived exact reload and a replay did not duplicate the turn. The temporary test session was deleted. See `verification/v5-09/live-dictation.json`.
- V5-08's real microphone and audible device playback acceptance remains a user-reported pass for that earlier check. On October 30, 2026, the user reported all four inline practice checks working: record/Stop, editable transcript and Send, repeat recording without renewed app consent, and Cancel preserving typed text. No device/browser inventory or detailed speech accuracy is invented.
- Production voice release, Hindi/Telugu speech, retained audio, camera input, streaming and automatic spoken character responses remain gated. The current scenario still uses the verified text presentation/runtime with optional English speech dictation; this does not advertise a complete voice-mode scenario.

## Recorded verification

129 unit tests and 56 PostgreSQL integration tests passed. The browser checks verified 37 English checks across the full run and one affected rerun, nine microphone/dictation checks, and six Hindi/Telugu text/export regressions (52 unique checks). The first English run had a browser trace-write failure caused by ENOSPC; the affected theme test passed with tracing disabled after generated-cache cleanup. Type checking, lint, production build and client privacy scan passed.

Localhost then exhausted disk again while persisting Turbopack data. The optional development filesystem cache is now disabled, with production configuration unchanged. After a cold restart, the practice document returned HTTP 200, all 24 referenced client scripts were served successfully, the client bundle contained Speak response and the capability was enabled. No fresh headless-browser visual run was attempted after that last disk failure; theme/composer browser checks had already passed before it. `localhost-recovery.json` records this boundary. Disk remains critically low and needs at least 2GB freed for reliable ongoing testing.

## Inline simplification verification

The updated client passed 129 unit tests and 11 microphone/dictation browser checks. Nine journey/polish checks passed across the initial run and the focused keyboard rerun; the keyboard test was updated to read the session ID from the navigation URL because practice entry now creates a document and invalidates the old response-body handle. New checks cover once-per-browser approval after reload/send, revocation, automatic Stop-to-transcribe, appending without losing simultaneous typing, cancellation/late results, permission denial, retry, word limits, send/reload provenance, contrast and reflow. Type checking, lint, production build (optional persistent build cache disabled) and privacy scan passed. Representative light/dark desktop/phone recording and ready states were visually inspected. The development indicator was hidden so it cannot overlap the word counter during local testing. No additional human-device pass or live Meta request was claimed for this client-only update.

## Inline practice acceptance — October 30, 2026

The user confirmed all four requested checks work well in localhost practice: Speak response → Stop recording; transcript appears in the chat draft and can be edited/sent; subsequent capture remembers app approval; Cancel stops capture and preserves typed text. This is user-reported acceptance of the dictation flow. Device/browser inventory was not supplied. Automatic character readback, speaking avatar, streaming and full voice-room acceptance remain pending.
