> Superseded: the user rejected the illustrated character. It has been removed in favor of a photographic stage. The user subsequently selected Simli. See [current live-video preview](V5_09_SIMLI.md). The content below records earlier implementation history.

# V5-09 — Priya's speaking 2D character

Implemented October 30, 2026. This completes the local 2D renderer and voice-state implementation on top of the already user-accepted Hindi/Telugu spoken practice flow. Production release, fluent translation review and streaming/full-duplex conversation remain separate work.

## What changed

Priya now has a small inline SVG illustration with speaking-mouth motion, subtle posture motion and a voice indicator. **Use portrait** switches to the existing photograph without affecting speech; **Use 2D character** switches back. A failed portrait load falls back to initials. There are no new libraries, image-generation services, microphone streams, camera permissions, provider calls or simulation writes from the renderer.

The displayed states distinguish **Ready**, **Waiting for microphone**, **Listening**, **Transcribing**, **Thinking**, **Preparing voice**, and **Speaking**. Thinking applies only to sending a response, not creating an alternative path. Recording and turn processing take priority over stale audio presentation.

Speaking motion starts on the device utterance's real `start` event, not when playback is merely queued. Stop, end, error, device pause, timeout, microphone capture, hidden/leaving page and changing paths stop the motion. Generation IDs reject late events from cancelled audio and previous paths. A queued utterance is labelled Preparing until it starts. Device pause cancels playback and offers Replay rather than continuing to animate silently.

Captions display the exact reply being prepared/spoken in the practice language; users can collapse them. These are full-reply captions, without fabricated word timing. Motion is explicitly labelled **Approximate speaking motion**: it is decorative timing from playback lifecycle, not phoneme alignment or audio-energy analysis. It makes no emotion/engagement inference. Reduced-motion preferences disable all character/wave motion while retaining state text, captions and controls. Portrait mode is a static fallback.

## Verification

- 135 unit checks passed, including presentation priority so capture/processing suppress stale speech and queued speech is not labelled Speaking.
- Full speech browser suite: 20 checks passed. Final focused renderer checks cover all three locales, actual-event gating via controlled utterance events, late start rejection, Stop/Replay/end/error/pause, capture and transcription states, generation states, path-switch cancellation, unchanged saved messages, captions, static portrait fallback and reduced motion. Audio/provider results in this suite are mocked; fake microphone capture uses the real AudioWorklet.
- Light and dark character/composer sections passed automated accessibility checks; 320/390/1440 layouts had no horizontal overflow. Four final light/dark desktop/mobile character screenshots were inspected. The portrait name placement was adjusted after the first visual review to keep the face clear.
- A separate real installed English browser-voice check, with no synthesis mock, observed native playback start → visible Speaking → Stop → Ready, with captions present. This establishes native event wiring, not that a person heard the audio. An owned acceptance session was deleted after this check; no private practice was used. See `docs/verification/v5-09/avatar-native-playback.json`.
- Final TypeScript, lint, production build, privacy scan and journey/polish results are recorded in `docs/verification/v5-09/avatar-acceptance.json`.

Previous user reports accepted Hindi/Telugu automatic replies, Replay, reviewed dictation submission and interruption. Those reports predate this new character. Human visual acceptance of the final 2D rendering has not been reported; neither platform inventory nor fluent translation approval is inferred. English automatic-reply hearing acceptance remains distinct from the native browser-event check.

## Local review

Refresh an existing practice, enable **Auto speak replies**, and check that the character moves when Priya speaks and stops with Stop or recording. Try **Use portrait**, then **Use 2D character**. Captions stay readable and saved conversation history stays unchanged. Local Hindi/Telugu review runs with `npm run dev:locales`.

Streaming ASR, token/word-aligned audio, full-duplex speech, phoneme lip-sync, 3D, camera analysis and AWS deployment are not introduced by this slice. They do not block this local push-to-talk implementation.
