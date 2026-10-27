# Meta Muse Spark adapter

Documentation checked October 27, 2026:

- https://dev.meta.ai/docs/protocols/chat-completions
- https://dev.meta.ai/docs/models
- https://dev.meta.ai/docs/structured-output

The official documentation describes bearer authentication, `POST https://api.meta.ai/v1/chat/completions`, model `muse-spark-1.3`, `response_format.type = json_schema`, and text at `choices[0].message.content`.

The adapter uses native server-side fetch, a 30-second timeout, schema-constrained output, and independent Zod validation. It sends bounded recent dialogue, the pinned fictional policy and persona, state, and only explicitly revealed personal knowledge. It never requests hidden reasoning. Returned deltas cannot bypass the server reducer. HTTP errors, invalid JSON, and invalid proposals produce recoverable errors without committing a turn. Meta mode never silently falls back to mock mode.

## Private configuration

Set `AI_PROVIDER=meta` and `META_API_KEY` privately in `.env`. The local variable is named `META_API_KEY`; Meta examples name their key variable `MODEL_API_KEY`, but both supply the same bearer header. Use `META_MODEL=muse-spark-1.3` unless your participant access requires another documented model ID. Restart the server after changing these values.

Live smoke verification on October 27, 2026: the configured key returned HTTP 200 from Muse Spark 1.3. The application adapter also returned HTTP 200 with a validated structured character turn, two saved snapshots, and preserved history after reload. The temporary verification session was deleted. Phase 2 live acceptance subsequently passed: five turns, reload and a sixth turn, access isolation, private-knowledge boundaries on the tested inputs, and an independent live alternative with comparison. Seven generated responses had verified Meta metadata. Genuine upstream 401 handling preserved the draft and committed no turn. See [Phase 2 acceptance](PHASE_2_ACCEPTANCE.md) for evidence and rerun instructions. Account quotas, billing/credits, broader scenario coverage, and deployed production behavior remain unverified. The key is stored only in the ignored private .env file.

## Verification procedure

1. Confirm the participant key can access the documented model without printing the key.
2. Start a new session in Meta mode; send multiple turns and inspect server-side provider metadata.
3. Verify a guarantee challenge, knowledge boundaries, reload/resume, fork isolation, and comparison.
4. Exercise an invalid credential or simulated transport failure against a test environment and confirm no partial turn.
5. Record only status, model, timing, and redacted request identifiers. Do not publish provider bodies or secrets.

Streaming is deferred because only a fully validated response may commit authoritative state. The UI shows a pending response indicator while waiting.
