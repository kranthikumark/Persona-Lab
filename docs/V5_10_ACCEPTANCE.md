# V5-10 — Private audio/video authoring sources

Implemented locally October 31, 2026. This is a private reference-source workflow inside the existing Scenario Studio. It does not create a new simulation runtime, change canonical insurance facts, analyse video scenes, or publish scenarios automatically.

## Use it

1. Open `http://127.0.0.1:3100/create` through **Create a scenario**. Create a private draft, or select one. Save any brief changes before working with sources.
2. In **Reference material**, choose a WAV, MP3, M4A, MP4 or WebM file. Clips need an audio track and readable duration metadata: 0.25–60 seconds, at most 20 MiB. Select the declared source language and 1-day or 7-day retention. Confirm rights and private retention, then choose **Save private source**.
3. Choose **Transcribe with Meta** to explicitly send the audio track for transcription, or type a transcript manually. For video, only extracted audio goes to Meta. Frames, scenes, faces and emotions are not analysed. Availability follows the existing localhost speech-locale gates; manual entry remains available when transcription is unavailable.
4. Correct the transcript and, optionally for Hindi/Telugu sources, supply an English translation. Confirm review and choose **Review & attach source**. Earlier transcript versions remain accessible under **Transcript history**. Source locale does not change the English scenario/runtime.
5. Edit the scenario brief/objectives using the reviewed reference. Approved policy facts, constraints and rubric remain fixed. The existing named OS operator inspects the exact draft revision and source transcripts, then reviews/publishes it. Browser clients cannot claim operator privileges or publish.
6. **Delete source** removes its original file and every transcript version, detaches it from the current draft, and invalidates current approval. Published scenarios, sessions and reports stay unchanged. **Reload sources** refreshes processing status, including recovery of an interrupted job.

## Storage and access

- The initial object-store adapter uses a dedicated private filesystem directory. Default: `.private-media/`, Git-ignored, outside `public/` and generated application files. It is not an S3 integration. Configure `PERSONA_MEDIA_DIR` for a dedicated directory outside the project; a directory inside the project must be under `.private-media/`.
- Directory permissions must be 0700; raw objects are created with mode 0600 under server-generated UUID names. Client filenames never become filesystem paths. Symlink directories/objects and traversal identifiers are rejected. Private source bytes never go into PostgreSQL.
- Original media is served only through an owner-checked, non-cached proxy route. It supports bounded byte ranges for playback. URLs are not public share links. Foreign owners receive 404; write routes also check origin. A cleared browser owner cookie loses access; account-based ownership is future work.
- PostgreSQL stores metadata, checksums, consent, source language, processing state and versioned transcripts. ASR creates a draft transcript; creator approval creates a new immutable version. There are at most 20 transcript versions per source. Earlier versions cannot be updated in place but are erased when the source is deleted.
- Upload/processing/review/deletion coordinate with draft row locks and revisions. Source mutations clear operator approval. Clients cannot forge source references through normal draft saves. Publication validates every current source and pins reviewed version/hash/provenance without copying private transcript text or raw media into public scenarios.
- Published provenance records identify a private, deletable source. They are not a promise that the original file will remain available. Source deletion cannot change immutable published scenario content or running conversations.

## Consent, bounds and cleanup

- Upload requires rights and explicit retention permission. Meta processing is a separate explicit choice. Server timestamps and purposes are retained with the asset. No learner microphone/camera capture is introduced by authoring uploads.
- Retention is 1 or 7 days, capped by the draft's expiry. Expired source/transcript reads are denied immediately; the listing redacts transcript content and filename while deletion awaits cleanup.
- Five sources per draft; ten per browser owner; 100 MiB reserved bytes per owner and 500 MiB globally. Upload admission: 20 per owner/hour and 100 globally/hour. Source ASR admission: 20 per owner/hour and 100 globally/hour. Failed attempts can consume admission. These limits are separate from Simli practice previews.
- Uploads are streamed with an exact declared-size check, 20 MiB ceiling and 120-second deadline. Type signatures, extension, actual streams, MIME and duration are checked. FFprobe/FFmpeg use fixed executable paths, no shell, local-only protocol allowlists, a per-allocation memory cap, bounded output/time, and at most two simultaneous tool processes per worker. Video is demuxed, not semantically analysed. Decoder-generated audio is validated against the existing mono PCM/60-second contract; overlong input is not silently accepted as a shortened transcript.
- Processing has a 90-second lease. A reload after an interrupted lease marks the source failed and permits retry/manual review. Late processing cannot recreate a deleted source or transcript.
- Deletion first creates an inaccessible tombstone, then erases the file and transcript rows. If file erasure fails, raw reads and listing text remain blocked; cleanup retries the tombstone. Deleting/expiring a draft also cleans its source files, including orphaned draft references.
- Run `npm run db:purge` for expired sources, stale uploads, deletion retries and abandoned work directories, alongside existing session/draft cleanup. Scheduled execution remains part of deployment setup. Private media objects need their own coordinated backup policy; PostgreSQL backups cover metadata/transcripts, not raw files.
- Runtime private objects, backups, reports and `.env` files are excluded from deployment tracing. The release check verifies private runtime files are absent from server traces and actual credentials are absent from client chunks.

## Verification evidence

- Before migration: isolated backup/restore verified 14 tables and 2,163 rows. After migration: 16 tables and 2,171 rows verified. The two new tables and transcript immutability trigger are additive; no destructive reset or scenario/report backfill was performed. Counts differ because of normal quota/test traffic, not a claim that row counts alone prove preservation.
- 149 unit checks pass, including media format admission, exact-size streaming, private modes, traversal/symlink refusal and byte-range validation.
- Five isolated media database checks pass: ownership/revision checks; immutable ASR/review versions; reviewed source publication; privacy-preserving deletion without changing a published scenario; deletion during processing; failure/manual recovery; expiry; tombstone retry. Three existing isolated catalog checks also pass, including normal practice/fork/evaluation/export through a published version.
- Three media browser checks pass across dark/light themes, desktop/390px/320px, reload, version history, ownership, CSRF/retention denial, fake formats, range playback and deletion. Automated accessibility scans report zero violations. Three existing Scenario Studio browser regressions pass.
- One real Meta ASR call passed on an authored synthetic English video: upload → audio extraction → transcription → creator-reviewed attachment → private range read → deletion. Foreign file access returned 404; deletion returned the file to 404, with no remaining sources. The disposable practice draft and temporary fixture were removed. See `verification/v5-10/live-media.json`.
- TypeScript, lint, production build and client/server-trace privacy checks pass. Only the existing Indic Word-font tracing warning remains after marking private runtime I/O as non-build assets.

## Remaining acceptance and delivery scope

The user has not yet reviewed this new source-authoring UI using their own clip. Hindi/Telugu source transcription/translation quality is not newly accepted by this English fixture. Existing native-language publication gates remain. AWS deployment, S3/shared storage, automatic video understanding and new scenario runtimes are not delivered by this increment. Repository delivery was requested October 31. Deployment and own-clip human acceptance remain separate.

## Operator setup

FFmpeg and FFprobe must be installed. macOS defaults use `/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/ffprobe`; Ubuntu defaults use `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`. Override absolute paths with `PERSONA_FFMPEG_PATH` and `PERSONA_FFPROBE_PATH`. The existing Meta key is reused server-side. `npm run test:media` creates/removes a disposable local PostgreSQL database; `npx playwright test --config playwright.media.config.ts` uses mock practice mode, manual transcript review and a temporary private store, without sending source audio to a provider. `node --import tsx scripts/verify-media-live.ts --live-meta` explicitly opts into one real synthetic-fixture ASR check on localhost macOS.

FFmpeg reference: [protocol allowlists](https://ffmpeg.org/ffmpeg-protocols.html#Protocol-Options) and [FFprobe stream metadata](https://ffmpeg.org/ffprobe.html). Installed MOV demuxer help was checked for disabled external data references.
