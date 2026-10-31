# Historical Meta avatar access investigation

Historical snapshot, October 30, 2026. **Superseded:** the user subsequently selected Simli and configured its key and face ID. See [current Simli implementation](V5_09_SIMLI.md). The Meta access findings below remain relevant only to a future Meta adapter.

Original investigation: The user rejected the illustrated 2D character and requested a photographic person with natural talking-photo motion and lip sync. They selected **Meta Muse Realtime Avatar only**; no D-ID, HeyGen or other avatar provider is authorized or integrated.

## Delivered now

The cartoon SVG and its mouth/posture animation are removed. Practice uses Priya's existing photograph in a larger stage, alongside the conversation and simple inline voice controls. The timeline moves below the two main panels. Scenario context is expandable. Mobile uses a full-width portrait rather than a thumbnail. Existing spoken replies, Hindi/Telugu dictation, captions, Stop/Replay, local Mac voice fallback and the voice activity indicator are retained. The face stays still; the UI labels it **Portrait · spoken replies** and does not claim live video. Reduced-motion settings stop the activity indicator.

This is a visual correction and a truthful fallback, not a completed natural lip-sync implementation.

## Verified Meta access boundary

[Meta's official research announcement](https://research.meta.ai/blog/bringing-your-muse-to-life) describes Muse Realtime Avatar as reference-media-conditioned video generation coupled to Muse Realtime Voice's speech-token stream. This matches the desired capability. It is not an API request/response specification. It also does not establish that arbitrary WAV audio from our current playback can drive the model, nor that saved replies can be rendered verbatim.

[The public model catalog](https://dev.meta.ai/docs/models) currently documents Muse Spark/Wonder text outputs, Muse Image, Muse Voice Transcribe and SAM APIs, plus open-weight model families. I did not find a Muse Realtime Voice/Avatar endpoint or SDK in those developer docs.

The documented [GET /v1/models](https://dev.meta.ai/docs/api-reference/models/list-models) call with this workspace's existing ignored Meta key returned HTTP 200 on October 30. It listed nine model IDs, with no Realtime Avatar or Realtime Voice model. Evidence: `docs/verification/v5-09/meta-avatar-access.json`. No photo, private practice, audio or prompt was uploaded, and no generation request was made. Absence from this catalog does not prove that Meta has no separate private-preview access path.

The user has been asked whether they have developer-preview access or documentation. The integration needs that supported contract; do not invent an endpoint/model ID, scrape the Muse consumer app, bypass access controls, or send private content to an unverified API. No additional provider or credential was added. Recheck the documented catalog with `node --import tsx scripts/verify-meta-avatar-access.ts`; model names alone must never enable the feature automatically.

## Steps once Meta supplies a supported API

1. Verify access, transport, credentials, reference-image upload/lifecycle and supported languages from official developer/preview docs. Confirm whether the existing key is sufficient.
2. Confirm a supported way to preserve Persona Lab's authoritative turn logic. The visible/spoken avatar must render the saved, validated reply exactly, or use a documented constrained/tool-controlled realtime flow. It must not independently invent a second conversation or rewrite history.
3. Implement a server-only Meta session adapter. Bind sessions and responses to the owner, practice path, revision and reply ID. Configure quotas, deadlines, cancellation, media lifetime and provider-specific processing disclosure from the real contract.
4. Render actual synchronized audio/video in the portrait stage. Drive Speaking from real media events, use the photo while connecting/idle/disconnected, keep exact captions and Stop/Replay, and cancel old media on recording/path changes. Avoid playing device TTS over the video's own audio.
5. Verify one real English exchange for face consistency, synchronization, naturalness and latency before enabling it. Test Hindi and Telugu independently; prior dictation and device speech acceptance do not establish avatar-language support.
6. Test interruption, stale/late results, provider failure/reconnect, branch switching, reduced motion and mobile playback. Preserve text-only practice and historical reports. Enable only the locales actually accepted.

## Remaining blocker

**True Meta photo animation/lip sync is pending a verified developer API/access path.** No working realtime avatar integration or new avatar-language acceptance is claimed by the photographic UI update.
