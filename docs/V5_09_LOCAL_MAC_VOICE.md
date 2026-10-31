# Installed Mac voice fallback — October 30, 2026

The user reported that Telugu playback remained unavailable after installing Geeta. Both Geeta and Geeta (Enhanced) are installed on this Mac, confirmed through `say -v '?'`; local Telugu synthesis produced valid audio. The first Chrome probe returned an empty list before lazy voice enumeration completed. A later fresh Chrome did expose a Telugu voice. Existing browsers can still expose an older or incomplete voice catalog; installing an OS voice alone does not prove that a particular open browser can use it.

## Result

Practice prefers an installed, matching Web Speech voice. When that browser voice is missing, the configured localhost Mac can generate the saved AI reply with its installed voice, preferring Enhanced. The UI then shows **Uses Geeta (Enhanced) installed on this Mac** and enables Auto speak and Replay. Installed voice enumeration also refreshes when the browser regains focus.

This fallback uses macOS `/usr/bin/say`, no shell and no new cloud provider. It is available only in development, on a configured HTTP(S) loopback origin, on macOS, with speech acceptance enabled. Hindi/Telugu additionally require the existing local language preview. It is disabled in production and on Ubuntu; AWS will need a separately selected playback solution.

## Data and lifecycle

The POST endpoint `/api/branches/ID/speech/playback` accepts only a message ID and current revision. It verifies origin, owner/expiry, path membership, assistant role and revision; it never accepts arbitrary text to synthesize. It reads the saved reply in its original language, bounds text to 2,500 characters, limits synthesis to 20 seconds, caps generated WAV size, and applies owner/global quotas and a two-job process limit. Revision/ownership are checked again before returning audio.

Synthesis creates a private temporary directory and generated WAV, removed in normal request cleanup before returning the response. This is transient generated-reply audio on local disk, distinct from the microphone pipeline's memory-only capture. Audio responses use `Cache-Control: no-store, private`. The browser holds a blob URL only during playback and revokes it on end/cancel. Abort, path changes, hidden/leaving page, Stop, device pause and recording cancel pending or active playback. Native HTMLAudio `playing`/`ended` events drive the same character and caption state as Web Speech. No simulation writes or new microphone consent purpose are introduced.

## Verification

- Installed Geeta and Enhanced inventory confirmed; direct local synthesis and an authenticated endpoint request returned a valid RIFF/WAV (458,228 bytes, about 9.46 seconds for the public Telugu opening).
- A real audio test simulates only an empty Web Speech catalog. Synthesis and HTMLAudio playback are real. It passed generation, actual `playing` → speaking character, captions, Stop, Replay, recording interruption, foreign-origin/owner/stale-revision/foreign-message/arbitrary-text rejection, and unchanged saved history. An owned temporary test practice is deleted after the test.
- Twenty other speech/character checks passed in the full suite; the focused real fallback check also passed. No human hearing pass is inferred.
- 136 unit checks passed. TypeScript, lint, build/privacy and final focused browser results are recorded in `docs/verification/v5-09/native-mac-fallback.json`.

Refresh practice after updating. If Web Speech still misses Telugu, the local Mac fallback avoids that dependency. No browser restart is required for the fallback itself. These checks verify software playback events; the user has not yet reported hearing this new fallback.
