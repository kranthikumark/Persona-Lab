import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, access, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { beforeAll, afterAll, afterEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  createDraft,
  reviewDraft,
  publishDraft,
  saveDraft,
  deleteDraft,
} from "@/lib/catalog/service";
import { insuranceScenario } from "@/lib/scenarios/insurance";
import { DEFAULT_CATALOG } from "@/lib/practice/metadata";
import {
  uploadSource,
  transcribeSource,
  reviewSource,
  sourceFile,
  sourceList,
  deleteSource,
  purgeSourceAssets,
  sourceHistory,
} from "@/lib/media/service";
import { objectPath } from "@/lib/media/storage";
import * as storage from "@/lib/media/storage";
loadEnvFile(".env");
const url = new URL(process.env.DATABASE_URL!);
const isolated =
  process.env.PERSONA_MEDIA_TEST_DB === "1" &&
  url.pathname.startsWith("/persona_v510_test_") &&
  ["localhost", "127.0.0.1"].includes(url.hostname);
const test = isolated ? it : it.skip;
let root: string, wav: Uint8Array, video: Uint8Array;
const ffmpeg =
  process.env.PERSONA_FFMPEG_PATH ||
  (process.platform === "darwin"
    ? "/opt/homebrew/bin/ffmpeg"
    : "/usr/bin/ffmpeg");
beforeAll(async () => {
  if (!isolated) return;
  root = await mkdtemp(path.join(tmpdir(), "persona-v510-"));
  vi.stubEnv("PERSONA_MEDIA_DIR", path.join(root, "private"));
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("META_API_KEY", "synthetic-never-used-for-network");
  vi.stubEnv("PERSONA_ACCEPTANCE_RUN", randomUUID());
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
  execFileSync(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-ac",
    "1",
    "-ar",
    "24000",
    "-c:a",
    "pcm_s16le",
    path.join(root, "clip.wav"),
  ]);
  execFileSync(ffmpeg, [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=64x64:d=1",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    path.join(root, "clip.mp4"),
  ]);
  wav = new Uint8Array(await readFile(path.join(root, "clip.wav")));
  video = new Uint8Array(await readFile(path.join(root, "clip.mp4")));
  await db.scenario.create({
    data: {
      slug: insuranceScenario.slug,
      version: 1,
      definition: insuranceScenario,
      catalogMetadata: DEFAULT_CATALOG,
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.$disconnect();
  if (root) await rm(root, { recursive: true, force: true });
});
async function upload(
  owner: string,
  draft: { id: string; revision: number },
  bytes = wav,
  name = "clip.wav",
  mime = "audio/wav",
) {
  return uploadSource(
    draft.id,
    owner,
    {
      draftRevision: draft.revision,
      name,
      bytes: bytes.length,
      locale: "en-IN",
      retentionDays: 1,
      rights: true,
      retention: true,
    },
    mime,
    new Request("http://127.0.0.1/upload", {
      method: "POST",
      body: new Blob([Uint8Array.from(bytes)]),
    }),
  );
}
const asr = () =>
  new Response(
    JSON.stringify({
      transcript: "Please explain the exclusions before recommending a plan.",
      audioDurationMs: 1000,
    }),
  );
test("retains audio privately, reviews immutable transcript versions, publishes provenance, then erases media without changing a published scenario", async () => {
  const owner = randomUUID(),
    draft = await createDraft(owner),
    saved = await upload(owner, draft);
  await expect(
    sourceFile(draft.id, saved.source.id, "foreign", null),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    transcribeSource(draft.id, saved.source.id, owner, {
      revision: saved.source.revision,
      draftRevision: saved.draft.revision,
      processingConsent: false,
    }),
  ).rejects.toThrow();
  await expect(
    reviewDraft(draft.id, saved.draft.revision, "Synthetic reviewer"),
  ).rejects.toMatchObject({ status: 409 });
  const request = vi.fn(async () => asr());
  vi.stubGlobal("fetch", request);
  const transcribed = await transcribeSource(draft.id, saved.source.id, owner, {
    revision: saved.source.revision,
    draftRevision: saved.draft.revision,
    processingConsent: true,
  });
  expect(transcribed.source.status).toBe("transcribed");
  await expect(
    reviewDraft(draft.id, transcribed.draft.revision, "Synthetic reviewer"),
  ).rejects.toMatchObject({ status: 409 });
  const approved = await reviewSource(draft.id, saved.source.id, owner, {
    revision: transcribed.source.revision,
    draftRevision: transcribed.draft.revision,
    text: "Explain the exclusions clearly and ask about budget.",
    confirmed: true,
  });
  expect(
    await db.sourceTranscript.count({ where: { assetId: saved.source.id } }),
  ).toBe(2);
  expect(
    (await sourceHistory(draft.id, saved.source.id, owner)).versions,
  ).toHaveLength(2);
  await expect(
    sourceHistory(draft.id, saved.source.id, "foreign"),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    db.sourceTranscript.update({
      where: { assetId_version: { assetId: saved.source.id, version: 1 } },
      data: { text: "rewrite" },
    }),
  ).rejects.toThrow();
  await expect(
    saveDraft(draft.id, owner, approved.draft.revision, {
      ...(approved.draft.content as object),
      sources: [],
    }),
  ).rejects.toMatchObject({ status: 400 });
  const range = await sourceFile(
    draft.id,
    saved.source.id,
    owner,
    "bytes=0-15",
  );
  expect(range.file.data.length).toBe(16);
  expect(new TextDecoder().decode(range.file.data.slice(0, 4))).toBe("RIFF");
  await expect(
    sourceFile(draft.id, saved.source.id, owner, "bytes=999999999-"),
  ).rejects.toMatchObject({ status: 416 });
  await reviewDraft(
    draft.id,
    approved.draft.revision,
    "Synthetic operator - not human approval",
  );
  const publication = await publishDraft(draft.id, approved.draft.revision);
  const before = await db.scenario.findUniqueOrThrow({
    where: { id: publication.scenarioId },
  });
  const provenance = await db.scenarioPublication.findUniqueOrThrow({
    where: { scenarioId: publication.scenarioId },
  });
  expect((provenance.review as { sources: unknown[] }).sources).toHaveLength(1);
  expect(JSON.stringify(before.definition)).not.toContain(
    "Explain the exclusions clearly and ask about budget.",
  );
  const object = await objectPath(saved.source.id);
  await deleteSource(
    draft.id,
    saved.source.id,
    owner,
    approved.source.revision,
    approved.draft.revision,
  );
  await expect(access(object)).rejects.toThrow();
  expect(
    await db.sourceTranscript.count({ where: { assetId: saved.source.id } }),
  ).toBe(0);
  expect(
    await db.scenario.findUnique({ where: { id: publication.scenarioId } }),
  ).toEqual(before);
  await expect(
    sourceFile(draft.id, saved.source.id, owner, null),
  ).rejects.toMatchObject({ status: 404 });
});
test("video processing sends only extracted WAV to Meta, while deletion during processing prevents late transcript persistence", async () => {
  const owner = randomUUID(),
    draft = await createDraft(owner),
    saved = await upload(owner, draft, video, "clip.mp4", "video/mp4");
  expect(saved.source.kind).toBe("video");
  let release!: (response: Response) => void, started!: () => void;
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const audio = (init.body as FormData).get("audio") as Blob;
      expect(audio.type).toBe("audio/wav");
      expect(
        new TextDecoder().decode(
          new Uint8Array(await audio.arrayBuffer()).slice(0, 4),
        ),
      ).toBe("RIFF");
      started();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    }),
  );
  const pending = transcribeSource(draft.id, saved.source.id, owner, {
    revision: saved.source.revision,
    draftRevision: saved.draft.revision,
    processingConsent: true,
  });
  const rejected = expect(pending).rejects.toMatchObject({ status: 404 });
  await began;
  const a = await db.scenarioSourceAsset.findUniqueOrThrow({
      where: { id: saved.source.id },
    }),
    d = await db.scenarioDraft.findUniqueOrThrow({ where: { id: draft.id } });
  await deleteSource(draft.id, a.id, owner, a.revision, d.revision);
  release(asr());
  await rejected;
  expect(await db.sourceTranscript.count({ where: { assetId: a.id } })).toBe(0);
  expect(
    (await readdir(path.join(root, "private"))).some((n) =>
      n.startsWith("work-"),
    ),
  ).toBe(false);
});
test("failed processing cannot publish, creators can review manual text, expiry hides content and purges all source versions", async () => {
  const owner = randomUUID(),
    draft = await createDraft(owner),
    saved = await upload(owner, draft);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response("private provider failure", { status: 503 }),
    ),
  );
  await expect(
    transcribeSource(draft.id, saved.source.id, owner, {
      revision: saved.source.revision,
      draftRevision: saved.draft.revision,
      processingConsent: true,
    }),
  ).rejects.toMatchObject({ status: 502 });
  let d = await db.scenarioDraft.findUniqueOrThrow({ where: { id: draft.id } });
  const a = await db.scenarioSourceAsset.findUniqueOrThrow({
    where: { id: saved.source.id },
  });
  expect(a.status).toBe("failed");
  await expect(
    reviewDraft(draft.id, d.revision, "Synthetic reviewer"),
  ).rejects.toMatchObject({ status: 409 });
  const reviewed = await reviewSource(draft.id, a.id, owner, {
    revision: a.revision,
    draftRevision: d.revision,
    text: "Creator-entered reference transcript.",
    confirmed: true,
  });
  await db.scenarioSourceAsset.update({
    where: { id: a.id },
    data: { expiresAt: new Date(0) },
  });
  const expired = (await sourceList(draft.id, owner)).sources[0];
  expect(expired.transcript).toBeNull();
  expect(expired.name).toBe("Expired source");
  await expect(sourceFile(draft.id, a.id, owner, null)).rejects.toMatchObject({
    status: 404,
  });
  await purgeSourceAssets();
  expect(
    await db.scenarioSourceAsset.findUnique({ where: { id: a.id } }),
  ).toBeNull();
  d = await db.scenarioDraft.findUniqueOrThrow({ where: { id: draft.id } });
  expect((d.content as { sources: unknown[] }).sources).toEqual([]);
  expect(d.revision).toBeGreaterThan(reviewed.draft.revision);
});
test("rejects fake formats and stale/foreign mutations, and draft deletion removes private sources", async () => {
  const owner = randomUUID(),
    draft = await createDraft(owner);
  await expect(
    uploadSource(
      draft.id,
      "foreign",
      {
        draftRevision: 1,
        name: "a.wav",
        bytes: 3,
        locale: "en-IN",
        retentionDays: 1,
        rights: true,
        retention: true,
      },
      "audio/wav",
      new Request("http://localhost/", { method: "POST", body: "bad" }),
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    upload(
      owner,
      draft,
      new TextEncoder().encode("#EXTM3U\nhttps://example.test/private"),
      "a.wav",
    ),
  ).rejects.toMatchObject({ status: 422 });
  const current = await db.scenarioDraft.findUniqueOrThrow({
    where: { id: draft.id },
  });
  const saved = await upload(owner, current);
  await expect(
    reviewSource(draft.id, saved.source.id, owner, {
      revision: saved.source.revision,
      draftRevision: 1,
      text: "Stale approval",
      confirmed: true,
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    deleteSource(
      draft.id,
      saved.source.id,
      "foreign",
      saved.source.revision,
      saved.draft.revision,
    ),
  ).rejects.toMatchObject({ status: 404 });
  const object = await objectPath(saved.source.id);
  await deleteDraft(draft.id, owner);
  await expect(access(object)).rejects.toThrow();
  expect(
    await db.scenarioSourceAsset.findUnique({ where: { id: saved.source.id } }),
  ).toBeNull();
});
test("a failed file erasure leaves a private tombstone and cleanup retries it", async () => {
  const owner = randomUUID(),
    draft = await createDraft(owner),
    saved = await upload(owner, draft);
  const reviewed = await reviewSource(draft.id, saved.source.id, owner, {
    revision: saved.source.revision,
    draftRevision: saved.draft.revision,
    text: "Private text to erase.",
    confirmed: true,
  });
  const erase = vi
    .spyOn(storage, "removeObject")
    .mockRejectedValueOnce(new Error("Simulated storage unavailable"));
  try {
    await expect(
      deleteSource(
        draft.id,
        saved.source.id,
        owner,
        reviewed.source.revision,
        reviewed.draft.revision,
      ),
    ).rejects.toThrow("Simulated storage unavailable");
  } finally {
    erase.mockRestore();
  }
  const pending = (await sourceList(draft.id, owner)).sources[0];
  expect(pending.status).toBe("deleting");
  expect(pending.transcript).toBeNull();
  expect(pending.name).toBe("Source deletion pending");
  await expect(
    sourceFile(draft.id, saved.source.id, owner, null),
  ).rejects.toMatchObject({ status: 404 });
  await purgeSourceAssets();
  expect(
    await db.scenarioSourceAsset.findUnique({ where: { id: saved.source.id } }),
  ).toBeNull();
  await expect(access(await objectPath(saved.source.id))).rejects.toThrow();
});
