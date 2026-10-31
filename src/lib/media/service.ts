import "server-only";
import { randomUUID } from "node:crypto";
import {
  Prisma,
  type ScenarioSourceAsset,
  type SourceTranscript,
} from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { reserveBudget } from "@/lib/release/limits";
import { DraftContentSchema } from "@/lib/catalog/schema";
import { transcribeMeta } from "@/lib/speech/provider";
import { speechLocaleAvailable } from "@/lib/speech/capabilities";
import {
  UploadMeta,
  ReviewInput,
  ProcessInput,
  sourceFormat,
  sourceName,
  type SourceDTO,
} from "./contracts";
import {
  commitObject,
  objectPath,
  storeUpload,
  removeObject,
  readObject,
  cleanTemporaryFiles,
} from "./storage";
import {
  inspectSource,
  mediaToolsAvailable,
  withSourceAudio,
} from "./processing";
import { transcriptHash } from "./review";

type Tx = Prisma.TransactionClient;
type Asset = ScenarioSourceAsset & { transcripts: SourceTranscript[] };
const latest = {
  transcripts: { orderBy: { version: "desc" as const }, take: 1 },
};
export async function lockDraft(
  tx: Tx,
  id: string,
  owner: string | null,
  revision?: number,
) {
  if (!owner) throw new ApiError(404, "Draft not found on this browser.");
  await tx.$queryRaw`SELECT "id" FROM "ScenarioDraft" WHERE "id"=${id} AND "ownerHash"=${owner} FOR UPDATE`;
  const row = await tx.scenarioDraft.findFirst({
    where: { id, ownerHash: owner, expiresAt: { gt: new Date() } },
  });
  if (!row) throw new ApiError(404, "Draft not found on this browser.");
  if (revision !== undefined && row.revision !== revision)
    throw new ApiError(409, "Draft changed. Reload before continuing.");
  return row;
}
export function draftDTO(row: {
  id: string;
  revision: number;
  status: string;
  content: Prisma.JsonValue;
  review: Prisma.JsonValue | null;
}) {
  return {
    id: row.id,
    revision: row.revision,
    status: row.status,
    content: row.content,
    review: row.review,
  };
}
async function bumpDraft(tx: Tx, id: string, content?: Prisma.InputJsonValue) {
  return tx.scenarioDraft.update({
    where: { id },
    data: {
      revision: { increment: 1 },
      status: "draft",
      review: Prisma.DbNull,
      ...(content ? { content } : {}),
    },
  });
}
function sourceDTO(row: Asset): SourceDTO {
  const expired = row.expiresAt <= new Date(),
    deleting = row.status === "deleting",
    t = expired || deleting ? null : row.transcripts[0];
  return {
    id: row.id,
    revision: row.revision,
    status: expired ? "expired" : row.status,
    name: deleting
      ? "Source deletion pending"
      : expired
        ? "Expired source"
        : row.originalName,
    kind: row.kind,
    contentType: row.contentType,
    byteSize: row.byteSize,
    locale: row.locale,
    durationMs: row.durationMs,
    expiresAt: row.expiresAt.toISOString(),
    failureReason: expired || deleting ? null : row.failureReason,
    transcript: t
      ? {
          version: t.version,
          text: t.text,
          translation: t.translation,
          locale: t.locale,
          provider: t.provider,
          model: t.model,
          reviewedAt: t.reviewedAt?.toISOString() ?? null,
        }
      : null,
  };
}
async function assetFor(
  tx: Tx,
  id: string,
  owner: string | null,
  draftId: string,
  revision?: number,
  allowExpired = false,
) {
  const a = await tx.scenarioSourceAsset.findFirst({
    where: { id, ownerHash: owner ?? "", draftId },
    include: latest,
  });
  if (
    !a ||
    a.status === "deleting" ||
    (!allowExpired && a.expiresAt <= new Date())
  )
    throw new ApiError(
      404,
      "Source not found on this browser or it has expired.",
    );
  if (revision !== undefined && a.revision !== revision)
    throw new ApiError(409, "Source changed. Reload before continuing.");
  return a;
}
export async function sourceList(draftId: string, owner: string | null) {
  return db.$transaction(async (tx) => {
    await lockDraft(tx, draftId, owner);
    await tx.scenarioSourceAsset.updateMany({
      where: {
        draftId,
        ownerHash: owner!,
        status: "processing",
        processingUntil: { lte: new Date() },
      },
      data: {
        status: "failed",
        failureReason:
          "Processing was interrupted. Retry transcription or enter the transcript manually.",
        processingUntil: null,
        revision: { increment: 1 },
      },
    });
    const assets = await tx.scenarioSourceAsset.findMany({
      where: { draftId, ownerHash: owner! },
      include: latest,
      orderBy: { createdAt: "asc" },
    });
    return {
      sources: assets.map(sourceDTO),
      toolsAvailable: await mediaToolsAvailable(),
      transcriptionLocales: ["en-IN", "hi-IN", "te-IN"].filter((l) =>
        speechLocaleAvailable(l),
      ),
    };
  });
}
export async function uploadSource(
  draftId: string,
  owner: string | null,
  metadata: unknown,
  mime: string,
  request: Request,
) {
  const input = UploadMeta.parse(metadata);
  const name = sourceName(input.name),
    extension = name.split(".").at(-1)?.toLowerCase();
  if (!["wav", "mp3", "m4a", "mp4", "webm"].includes(extension ?? ""))
    throw new ApiError(422, "Use a WAV, MP3, M4A, MP4 or WebM clip.");
  if (!(await mediaToolsAvailable()))
    throw new ApiError(
      503,
      "Media tools are unavailable. Ask your server operator to configure FFmpeg and FFprobe.",
    );
  const length = request.headers.get("content-length");
  if (length && Number(length) !== input.bytes)
    throw new ApiError(400, "File size does not match the upload.");
  const id = randomUUID();
  if (
    !owner ||
    !(await db.scenarioDraft.findFirst({
      where: { id: draftId, ownerHash: owner, expiresAt: { gt: new Date() } },
      select: { id: true },
    }))
  )
    throw new ApiError(404, "Draft not found on this browser.");
  const budgetPrefix =
    process.env.AI_PROVIDER === "mock" && process.env.PERSONA_ACCEPTANCE_RUN
      ? `test:${process.env.PERSONA_ACCEPTANCE_RUN}:`
      : "";
  await reserveBudget([
    {
      key: `${budgetPrefix}source-upload:owner:${owner}`,
      limit: 20,
      windowSeconds: 3600,
    },
    {
      key: `${budgetPrefix}source-upload:global`,
      limit: 100,
      windowSeconds: 3600,
    },
  ]);
  await db.$transaction(async (tx) => {
    const draft = await lockDraft(tx, draftId, owner, input.draftRevision);
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${"private-media:quota"}))`;
    const count = await tx.scenarioSourceAsset.count({
      where: { ownerHash: owner!, draftId },
    });
    const owned = await tx.scenarioSourceAsset.aggregate({
      where: { ownerHash: owner! },
      _sum: { byteSize: true },
      _count: true,
    });
    const total = await tx.scenarioSourceAsset.aggregate({
      _sum: { byteSize: true },
    });
    if (
      count >= 5 ||
      owned._count >= 10 ||
      (owned._sum.byteSize ?? 0) + input.bytes > 100 * 1024 * 1024 ||
      (total._sum.byteSize ?? 0) + input.bytes > 500 * 1024 * 1024
    )
      throw new ApiError(
        429,
        "Private media storage is full. Delete unused sources before uploading.",
      );
    await tx.scenarioSourceAsset.create({
      data: {
        id,
        ownerHash: owner!,
        draftId,
        originalName: name,
        kind: mime.startsWith("video/") ? "video" : "audio",
        contentType: mime,
        byteSize: input.bytes,
        locale: input.locale,
        status: "uploading",
        processingUntil: new Date(Date.now() + 180000),
        expiresAt: new Date(
          Math.min(
            draft.expiresAt.getTime(),
            Date.now() + input.retentionDays * 86400000,
          ),
        ),
        consent: {
          version: "authoring-media-v1",
          rights: true,
          retention: true,
          retentionDays: input.retentionDays,
          grantedAt: new Date().toISOString(),
          processing: false,
          cameraAnalysis: false,
        },
      },
    });
    await bumpDraft(tx, draftId);
  });
  try {
    const stored = await storeUpload(id, request, input.bytes);
    let format: string;
    try {
      format = sourceFormat(stored.prefix);
    } catch {
      throw new ApiError(
        422,
        "File contents are not a supported media format.",
      );
    }
    const extensions: Record<string, string[]> = {
      wav: ["wav"],
      mp3: ["mp3"],
      mp4: ["mp4", "m4a"],
      webm: ["webm"],
    };
    if (!extensions[format].includes(extension!))
      throw new ApiError(
        422,
        "The file extension does not match its contents.",
      );
    const inspected = await inspectSource(
      stored.path,
      format,
      mime,
      request.signal,
    );
    await commitObject(id);
    return await db.$transaction(async (tx) => {
      const draft = await lockDraft(tx, draftId, owner);
      const a = await assetFor(tx, id, owner, draftId);
      if (a.status !== "uploading")
        throw new ApiError(409, "Upload was cancelled.");
      const row = await tx.scenarioSourceAsset.update({
        where: { id },
        data: {
          ...inspected,
          sha256: stored.sha256,
          status: "uploaded",
          processingUntil: null,
          revision: { increment: 1 },
        },
        include: latest,
      });
      return { source: sourceDTO(row), draft: draftDTO(draft) };
    });
  } catch (error) {
    await db.scenarioSourceAsset.updateMany({
      where: { id, ownerHash: owner! },
      data: { status: "deleting", revision: { increment: 1 } },
    });
    await eraseSourceObject(id);
    throw error;
  }
}
export async function transcribeSource(
  draftId: string,
  id: string,
  owner: string | null,
  inputValue: unknown,
  signal?: AbortSignal,
) {
  const input = ProcessInput.parse(inputValue);
  const claimed = await db.$transaction(async (tx) => {
    await lockDraft(tx, draftId, owner, input.draftRevision);
    const asset = await assetFor(tx, id, owner, draftId, input.revision);
    if ((asset.transcripts[0]?.version ?? 0) >= 20)
      throw new ApiError(
        429,
        "This source has reached 20 transcript versions.",
      );
    if (!["uploaded", "failed", "transcribed"].includes(asset.status))
      throw new ApiError(
        409,
        "This source is not ready for transcription. Reviewed sources keep their approved version.",
      );
    if (!speechLocaleAvailable(asset.locale))
      throw new ApiError(
        503,
        "Meta transcription is unavailable for this language. You can enter and review a transcript manually.",
      );
    // Only explicitly requested source audio goes to the existing Meta adapter.
    await tx.scenarioSourceAsset.update({
      where: { id },
      data: {
        status: "processing",
        revision: { increment: 1 },
        failureReason: null,
        processingUntil: new Date(Date.now() + 90000),
        consent: {
          ...(asset.consent as Prisma.JsonObject),
          processing: {
            provider: "meta",
            audioOnly: true,
            grantedAt: new Date().toISOString(),
          },
        },
      },
    });
    const draft = await bumpDraft(tx, draftId);
    return { asset, processingRevision: asset.revision + 1, draft };
  });
  const prefix =
    process.env.AI_PROVIDER === "mock" && process.env.PERSONA_ACCEPTANCE_RUN
      ? `test:${process.env.PERSONA_ACCEPTANCE_RUN}:`
      : "";
  try {
    await reserveBudget([
      {
        key: `${prefix}source-asr:owner:${owner}`,
        limit: 20,
        windowSeconds: 3600,
      },
      { key: `${prefix}source-asr:global`, limit: 100, windowSeconds: 3600 },
    ]);
    const result = await withSourceAudio(
      await objectPath(id),
      (wav) =>
        transcribeMeta(
          wav,
          signal,
          claimed.asset.locale as "en-IN" | "hi-IN" | "te-IN",
        ),
      signal,
    );
    return await db.$transaction(async (tx) => {
      const draft = await lockDraft(tx, draftId, owner);
      const a = await assetFor(
        tx,
        id,
        owner,
        draftId,
        claimed.processingRevision,
      );
      if (a.status !== "processing")
        throw new ApiError(409, "Processing was cancelled.");
      const version = (a.transcripts[0]?.version ?? 0) + 1;
      await tx.sourceTranscript.create({
        data: {
          assetId: id,
          version,
          text: result.text,
          locale: a.locale,
          provider: result.provider,
          model: result.model,
        },
      });
      const asset = await tx.scenarioSourceAsset.update({
        where: { id },
        data: {
          status: "transcribed",
          revision: { increment: 1 },
          processingUntil: null,
        },
        include: latest,
      });
      return { source: sourceDTO(asset), draft: draftDTO(draft) };
    });
  } catch (error) {
    await db.scenarioSourceAsset.updateMany({
      where: { id, revision: claimed.processingRevision, status: "processing" },
      data: {
        status: "failed",
        revision: { increment: 1 },
        processingUntil: null,
        failureReason:
          "Transcription did not complete. Retry with consent or enter and review the transcript manually.",
      },
    });
    if (error instanceof ApiError && [404, 409].includes(error.status))
      throw error;
    throw new ApiError(
      error instanceof ApiError ? error.status : 502,
      "Transcription did not complete. Reload sources to retry or enter a reviewed transcript manually.",
    );
  }
}
export async function reviewSource(
  draftId: string,
  id: string,
  owner: string | null,
  inputValue: unknown,
) {
  const input = ReviewInput.parse(inputValue);
  return db.$transaction(async (tx) => {
    const draft = await lockDraft(tx, draftId, owner, input.draftRevision);
    const asset = await assetFor(tx, id, owner, draftId, input.revision);
    if (
      !["uploaded", "failed", "transcribed", "reviewed"].includes(asset.status)
    )
      throw new ApiError(
        409,
        "Wait for upload/processing before reviewing this source.",
      );
    const previous = asset.transcripts[0],
      version = (previous?.version ?? 0) + 1;
    if (
      previous?.reviewedAt &&
      previous.text === input.text &&
      previous.translation === (input.translation || null)
    )
      return { source: sourceDTO(asset), draft: draftDTO(draft) };
    if (version > 20)
      throw new ApiError(
        429,
        "This source has reached 20 transcript versions. Delete unused material before starting a new source.",
      );
    await tx.sourceTranscript.create({
      data: {
        assetId: id,
        version,
        text: input.text,
        translation: input.translation || null,
        locale: asset.locale,
        provider: "creator",
        basedOnVersion: previous?.version,
        reviewedAt: new Date(),
      },
    });
    const content = DraftContentSchema.parse(draft.content);
    content.sources = [
      ...(content.sources ?? []).filter((r) => r.assetId !== id),
      {
        assetId: id,
        transcriptVersion: version,
        transcriptHash: transcriptHash(
          input.text,
          input.translation || null,
          asset.locale,
        ),
      },
    ];
    const updated = await bumpDraft(tx, draftId, content);
    const a = await tx.scenarioSourceAsset.update({
      where: { id },
      data: {
        status: "reviewed",
        revision: { increment: 1 },
        failureReason: null,
      },
      include: latest,
    });
    return { source: sourceDTO(a), draft: draftDTO(updated) };
  });
}
export async function eraseSourceObject(id: string) {
  // Keep tombstones if deletion fails so scheduled cleanup can retry.
  await removeObject(id);
  await db.scenarioSourceAsset.deleteMany({
    where: { id, status: "deleting" },
  });
}
export async function deleteSource(
  draftId: string,
  id: string,
  owner: string | null,
  revision: number,
  draftRevision: number,
) {
  const draft = await db.$transaction(async (tx) => {
    const draft = await lockDraft(tx, draftId, owner, draftRevision);
    await assetFor(tx, id, owner, draftId, revision, true);
    await tx.scenarioSourceAsset.update({
      where: { id },
      data: {
        status: "deleting",
        revision: { increment: 1 },
        processingUntil: null,
      },
    });
    const content = DraftContentSchema.parse(draft.content);
    if (content.sources)
      content.sources = content.sources.filter((r) => r.assetId !== id);
    return bumpDraft(tx, draftId, content);
  });
  await eraseSourceObject(id);
  return { deleted: true, draft: draftDTO(draft) };
}
export async function sourceFile(
  draftId: string,
  id: string,
  owner: string | null,
  range: string | null,
) {
  await db.$transaction(async (tx) => {
    await lockDraft(tx, draftId, owner);
  });
  const a = await assetFor(db, id, owner, draftId);
  if (a.status === "uploading")
    throw new ApiError(404, "Source upload is not complete.");
  const file = await readObject(id, range);
  // Deletion/expiry during the read must not return the prepared bytes.
  await assetFor(db, id, owner, draftId);
  return { file, contentType: a.contentType, name: a.originalName };
}
export async function sourceHistory(
  draftId: string,
  id: string,
  owner: string | null,
) {
  return db.$transaction(async (tx) => {
    await lockDraft(tx, draftId, owner);
    await assetFor(tx, id, owner, draftId);
    const versions = await tx.sourceTranscript.findMany({
      where: { assetId: id },
      orderBy: { version: "desc" },
      take: 20,
      select: {
        version: true,
        text: true,
        translation: true,
        locale: true,
        provider: true,
        model: true,
        reviewedAt: true,
        createdAt: true,
      },
    });
    return { versions };
  });
}
export async function purgeSourceAssets(batchSize = 100) {
  const now = new Date();
  const assets = await db.scenarioSourceAsset.findMany({
    where: {
      OR: [
        { expiresAt: { lte: now } },
        { draftId: null },
        { status: "deleting" },
        { status: "uploading", processingUntil: { lte: now } },
      ],
    },
    select: { id: true, draftId: true, ownerHash: true },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });
  let deleted = 0;
  for (const asset of assets) {
    await db.$transaction(async (tx) => {
      if (asset.draftId) {
        await tx.$queryRaw`SELECT "id" FROM "ScenarioDraft" WHERE "id"=${asset.draftId} FOR UPDATE`;
        const draft = await tx.scenarioDraft.findUnique({
          where: { id: asset.draftId },
        });
        if (draft) {
          const content = DraftContentSchema.parse(draft.content);
          if (content.sources)
            content.sources = content.sources.filter(
              (r) => r.assetId !== asset.id,
            );
          await bumpDraft(tx, draft.id, content);
        }
      }
      await tx.scenarioSourceAsset.updateMany({
        where: { id: asset.id },
        data: { status: "deleting", revision: { increment: 1 } },
      });
    });
    await eraseSourceObject(asset.id);
    deleted++;
  }
  await cleanTemporaryFiles();
  return deleted;
}
