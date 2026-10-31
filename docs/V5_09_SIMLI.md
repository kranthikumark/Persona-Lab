# Simli live character preview

Updated October 31, 2026. The user selected Simli after the Meta-only API investigation. Meta remains the conversation/transcription engine. Simli renders audio from an owned, saved assistant reply.

## Use on localhost

1. Keep `SIMLI_API_KEY` and `SIMLI_FACE_ID` in the ignored server `.env`; both have been verified with the provider.
2. Run `npm run dev:locales` on this Mac, open practice and click **Enable video avatar**.
3. Turn **Auto speak replies** on, or select **Replay reply**. During connection the response is queued and **Wait… receiving avatar video** is shown. Device speech is not started automatically while video mode is selected.
4. **Stop reply** and recording cancel local playback. **End video** restores portrait/device speech. A failed connection offers **Retry video** and an explicit **Use voice only** choice.

## Startup and mute correction

The connecting video is renderable beneath its waiting overlay. SDK startup resolves when the first frame is presented; it no longer waits for an additional hidden frame. Existing decoded video is reused for subsequent replies, rather than waiting for idle motion before sending any audio.

The default LiveKit stream repeatedly received packets without decoding a frame on the test connection. Smaller 512-pixel streams played but cropped or displaced this character; those framing experiments were rejected. The adapter now uses Simli's supported direct WebRTC (P2P) transport with server-issued ICE relay credentials and the original 768-pixel face framing.

Speech activity follows the received avatar audio through an analyser when available, because signaling alone sometimes missed a restarted reply or announced silence ahead of delayed media. The analyser reads only the received remote stream; it is never connected to speakers and does not capture the learner microphone. The audio element itself is explicitly unmuted and played. Unsupported/suspended analysis falls back to SDK signals. A known PCM-duration minimum prevents an early silence signal from immediately cutting off delayed speech. Audio and video failures remain cancellable, with visible recovery actions.

## Verified versus pending

**User manual acceptance — October 31, 2026:** the user reports that enabling video, turning Auto speak on during connection, waiting without premature audio, lip-sync, Stop → Replay, and recording interruption all work. This records the supplied checklist as accepted on localhost. The exact language, browser and device were not specified; it does not imply acceptance for every language/platform.


The latest real English check verified a full 768×768 character, a playing/unmuted audio element (`paused: false`, `muted: false`, `readyState: 4`), Stop muting, and a second automatic playback request after Stop. The complete new-conversation journey did not finish; it remains **incomplete**, rather than full acceptance. Evidence: `docs/verification/v5-09/simli-live-en-IN.json`. Human hearing and lip-sync quality are not established by an automated media-state check.

Earlier Telugu/Hindi evidence predates the transport correction. Recheck those languages on the current adapter before recording new acceptance. The supplied startup/waiting/lip-sync/interruption/replay checklist is now accepted by user report. An independent complete new-turn automated journey and language-specific checks remain pending. No AWS deployment or production release is claimed.

## Limits and credentials

- Tokens allow 120 seconds, with a 60-second idle limit. The app allows up to 60 seconds for startup and bounds a missing-frame wait at 15 seconds. No automatic new-token reconnect is introduced.
- Shared local admissions remain two starts per browser owner per hour and eight globally per day. Errors distinguish these app limits from a provider credit-balance error. Diagnostic starts from this correction were subtracted from the local global counter only; existing user starts and other counters were preserved. This does not refund provider minutes.
- Account credentials stay server-side. Fixed-host token and ICE requests have deadlines and bounded, validated responses. Temporary TURN credentials are intended for the browser and are not account API keys. Route access checks owner, path, revision, origin, bounded JSON and lease nonce.
- The current PCM source uses installed Mac voices in localhost development. AWS Ubuntu/production still needs a verified renderable TTS source. Local generated WAV files are removed.
- Only saved assistant reply audio is sent to Simli by this adapter. No learner camera or microphone stream is sent to Simli. This work does not establish provider retention guarantees.
- The configured face is used as supplied and differs from the static Priya photograph. No reference-photo upload or custom face generation was performed.

## Software checks

Unit coverage includes signal bursts, delayed silence, cancellation, PCM conversion, server-only token/relay requests, and unsafe relay-response rejection. The database check verifies ownership/revision/lease isolation and unchanged history. Browser checks include explicit enable, slow/failing connection without device-speech fallback, explicit voice-only recovery, and actual synthetic video-frame presentation beneath the waiting overlay. Browser checks clear the Simli key and do not consume provider starts.

Build, TypeScript, lint and client privacy checks are recorded with the latest verification summary. The client privacy scan includes the actual Simli API key. The existing Indic Word-font tracing build warning remains. AWS deployment remains separate from repository delivery.

## Provider references

[JavaScript SDK guide](https://docs.simli.com/api-reference/javascript), [SDK reference](https://docs.simli.com/api-reference/javascript/reference), and installed `simli-client` 3.2.0 sources were inspected for P2P transport, session/ICE requests, PCM format and media lifecycle. Historical Meta investigation: `V5_09_META_REALTIME_AVATAR.md`.
