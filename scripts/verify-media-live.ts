import { request } from "playwright-core";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import type { SourceDTO } from "../src/lib/media/contracts";
type DraftReply = {
  id: string;
  revision: number;
  content: { sources?: unknown[] };
};
type SourceReply = { source: SourceDTO; draft: DraftReply };
if (!process.argv.includes("--live-meta"))
  throw new Error(
    "Pass --live-meta for one real Meta transcription of an authored synthetic fixture.",
  );
const work = await mkdtemp(path.join(tmpdir(), "persona-v510-live-"));
const root = "http://127.0.0.1:3100",
  context = await request.newContext({
    baseURL: root,
    extraHTTPHeaders: { origin: root },
  });
const evidence: Record<string, unknown> = {
  localDate: new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  }),
  scope:
    "Owned synthetic video source; one real Meta audio transcription; no publication or human language-review claim",
};
let draftId: string | undefined, assetId: string | undefined;
const text =
  "This is a fictional training example. Ask about the customer's needs and explain policy exclusions clearly.";
async function json<T = unknown>(
  response: Awaited<ReturnType<typeof context.get>>,
): Promise<T> {
  if (!response.ok()) throw new Error(`HTTP ${response.status()}`);
  return (await response.json()) as T;
}
try {
  execFileSync(
    "/usr/bin/say",
    [
      "-v",
      "Rishi",
      "--file-format=WAVE",
      "--data-format=LEI16@24000",
      "-o",
      path.join(work, "voice.wav"),
      "-f",
      "-",
    ],
    { input: text, stdio: ["pipe", "pipe", "pipe"] },
  );
  execFileSync(
    "/opt/homebrew/bin/ffmpeg",
    [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=320x240:r=12",
      "-i",
      path.join(work, "voice.wav"),
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
      path.join(work, "fixture.mp4"),
    ],
    { stdio: "pipe" },
  );
  const draft = await json<DraftReply>(
    await context.post("/api/catalog/drafts", { data: {} }),
  );
  draftId = draft.id;
  const bytes = await readFile(path.join(work, "fixture.mp4")),
    base = `/api/catalog/drafts/${draftId}/sources`;
  evidence.step = "upload";
  const upload = await json<SourceReply>(
    await context.post(base, {
      headers: {
        "content-type": "video/mp4",
        "x-source-meta": encodeURIComponent(
          JSON.stringify({
            draftRevision: draft.revision,
            name: "authored-training-fixture.mp4",
            bytes: bytes.length,
            locale: "en-IN",
            retentionDays: 1,
            rights: true,
            retention: true,
          }),
        ),
      },
      data: bytes,
    }),
  );
  assetId = upload.source.id;
  evidence.videoUpload =
    upload.source.kind === "video" && upload.source.status === "uploaded";
  evidence.step = "Meta transcription";
  const transcribed = await json<SourceReply>(
    await context.post(`${base}/${assetId}`, {
      data: {
        action: "transcribe",
        draftRevision: upload.draft.revision,
        revision: upload.source.revision,
        processingConsent: true,
      },
    }),
  );
  if (!transcribed.source.transcript) throw new Error("Missing transcript");
  evidence.metaTranscription = {
    status: transcribed.source.status,
    provider: transcribed.source.transcript.provider,
    model: transcribed.source.transcript.model,
    nonempty: !!transcribed.source.transcript.text.trim(),
    locale: transcribed.source.locale,
  };
  evidence.step = "review and attach";
  const reviewed = await json<SourceReply>(
    await context.post(`${base}/${assetId}`, {
      data: {
        action: "review",
        draftRevision: transcribed.draft.revision,
        revision: transcribed.source.revision,
        text,
        confirmed: true,
      },
    }),
  );
  evidence.reviewedAndAttached =
    reviewed.source.status === "reviewed" &&
    reviewed.draft.content.sources?.length === 1;
  const foreign = await request.newContext({ baseURL: root });
  try {
    evidence.foreignFileAccess = (
      await foreign.get(`${base}/${assetId}/file`)
    ).status();
  } finally {
    await foreign.dispose();
  }
  evidence.privateRangeRead = (
    await context.get(`${base}/${assetId}/file`, {
      headers: { range: "bytes=0-127" },
    })
  ).status();
  evidence.step = "deletion";
  await json(
    await context.delete(`${base}/${assetId}`, {
      data: {
        draftRevision: reviewed.draft.revision,
        revision: reviewed.source.revision,
      },
    }),
  );
  evidence.fileAfterDelete = (
    await context.get(`${base}/${assetId}/file`)
  ).status();
  evidence.remainingSources = (
    await json<{ sources: unknown[] }>(await context.get(base))
  ).sources.length;
  evidence.status = "passed";
} catch (error) {
  evidence.status = "incomplete";
  evidence.error =
    error instanceof Error && /^HTTP \d+$/.test(error.message)
      ? error.message
      : "Verification did not complete; no credentials or provider body logged.";
  process.exitCode = 1;
} finally {
  if (draftId)
    evidence.draftCleanup = (
      await context.delete(`/api/catalog/drafts/${draftId}`)
    ).status();
  await context.dispose();
  await rm(work, { recursive: true, force: true });
  await writeFile(
    "docs/verification/v5-10/live-media.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence));
}
