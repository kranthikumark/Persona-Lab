import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, hash } from "@/lib/api";
import { reserveBudget } from "@/lib/release/limits";
import { insuranceScenario } from "@/lib/scenarios/insurance";
import { CatalogSchema, DEFAULT_CATALOG } from "@/lib/practice/metadata";
import { DraftContentSchema, initialDraft, type CatalogEntry } from "./schema";

export const contentHash = (content: unknown) =>
  hash(JSON.stringify(DraftContentSchema.parse(content)));
export async function catalogEntries(): Promise<CatalogEntry[]> {
  const publications = await db.scenarioPublication.findMany({
    select: { scenarioId: true },
  });
  const scenarios = await db.scenario.findMany({
    where: {
      OR: [
        { slug: insuranceScenario.slug, version: 1 },
        { id: { in: publications.map((p) => p.scenarioId) } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  return scenarios.map((row) => {
    const definition = row.definition as unknown as typeof insuranceScenario;
    return {
      id: row.id,
      version: row.version,
      title: definition.title,
      description: definition.description,
      catalog: CatalogSchema.parse(row.catalogMetadata ?? DEFAULT_CATALOG),
      locales: row.version === 1 ? ["en-IN", "hi-IN", "te-IN"] : ["en-IN"],
    };
  });
}
function requireOwner(owner: string | null): asserts owner is string {
  if (!owner) throw new ApiError(404, "Draft not found on this browser.");
}
export async function listDrafts(owner: string | null) {
  if (!owner) return [];
  return db.scenarioDraft.findMany({
    where: { ownerHash: owner, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      revision: true,
      status: true,
      content: true,
      review: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
}
export async function createDraft(owner: string) {
  await reserveBudget([
    { key: "scenario-draft:global", limit: 100, windowSeconds: 3600 },
  ]);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`drafts:${owner}`}))`;
    if (
      (await tx.scenarioDraft.count({
        where: { ownerHash: owner, expiresAt: { gt: new Date() } },
      })) >= 20
    )
      throw new ApiError(
        429,
        "Keep at most 20 active drafts. Delete one to continue.",
      );
    const row = await tx.scenarioDraft.create({
      data: {
        ownerHash: owner,
        content: initialDraft(),
        expiresAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    return {
      id: row.id,
      revision: row.revision,
      status: row.status,
      content: row.content,
    };
  });
}
export async function saveDraft(
  id: string,
  owner: string | null,
  revision: number,
  input: unknown,
) {
  requireOwner(owner);
  const content = DraftContentSchema.parse(input);
  const result = await db.scenarioDraft.updateMany({
    where: { id, ownerHash: owner, revision, expiresAt: { gt: new Date() } },
    data: {
      content,
      revision: { increment: 1 },
      status: "draft",
      review: Prisma.DbNull,
    },
  });
  if (!result.count) {
    const row = await db.scenarioDraft.findFirst({
      where: { id, ownerHash: owner, expiresAt: { gt: new Date() } },
    });
    throw new ApiError(
      row ? 409 : 404,
      row
        ? "Draft changed. Reload before saving."
        : "Draft not found on this browser.",
    );
  }
  return { id, revision: revision + 1, status: "draft", content };
}
export async function deleteDraft(id: string, owner: string | null) {
  requireOwner(owner);
  const result = await db.scenarioDraft.deleteMany({
    where: { id, ownerHash: owner },
  });
  if (!result.count)
    throw new ApiError(404, "Draft not found on this browser.");
  return { deleted: true };
}
// Only imported by the local OS-operator CLI and integration tests. No HTTP
// handler accepts role claims, reviewer identity or publication requests.
export async function reviewDraft(
  id: string,
  revision: number,
  reviewer: string,
) {
  if (!reviewer.trim() || reviewer.length > 120)
    throw new ApiError(400, "A named operator review is required.");
  const row = await db.scenarioDraft.findFirst({
    where: { id, revision, expiresAt: { gt: new Date() } },
  });
  if (!row) throw new ApiError(409, "Draft missing, expired or changed.");
  const content = DraftContentSchema.parse(row.content);
  const review = {
    role: "local_operator",
    reviewer: reviewer.trim(),
    revision,
    contentHash: contentHash(content),
    reviewedAt: new Date().toISOString(),
    locale: "en-IN",
    translationStatus: "reviewed",
    runtime: "insurance-v1-rules-v2",
    rubric: "insurance-rubric-v3",
  };
  const changed = await db.scenarioDraft.updateMany({
    where: { id, revision, expiresAt: { gt: new Date() } },
    data: { status: "reviewed", review },
  });
  if (!changed.count) throw new ApiError(409, "Draft changed during review.");
  return review;
}
export async function publishDraft(id: string, revision: number) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${"scenario-publication:insurance"}))`;
    // Row lock coordinates with browser edits/deletes and prevents publication
    // of a reviewed revision while an edit invalidates its approval.
    await tx.$queryRaw`SELECT "id" FROM "ScenarioDraft" WHERE "id"=${id} FOR UPDATE`;
    const row = await tx.scenarioDraft.findFirst({
      where: { id, revision, expiresAt: { gt: new Date() } },
    });
    if (!row || !["reviewed", "published"].includes(row.status))
      throw new ApiError(409, "Review the current revision before publishing.");
    const content = DraftContentSchema.parse(row.content);
    const review = row.review as {
      role?: string;
      contentHash?: string;
      revision?: number;
      translationStatus?: string;
    };
    if (
      review?.role !== "local_operator" ||
      review.contentHash !== contentHash(content) ||
      review.revision !== revision ||
      review.translationStatus !== "reviewed"
    )
      throw new ApiError(409, "Review does not match this draft revision.");
    const existing = await tx.scenarioPublication.findUnique({
      where: {
        draftId_draftRevision: { draftId: id, draftRevision: revision },
      },
    });
    if (existing) return { scenarioId: existing.scenarioId };
    const latest = await tx.scenario.findFirst({
      where: { slug: insuranceScenario.slug },
      orderBy: { version: "desc" },
    });
    const definition = {
      ...insuranceScenario,
      title: content.title,
      description: content.description,
      objectives: content.objectives,
    };
    const scenario = await tx.scenario.create({
      data: {
        slug: insuranceScenario.slug,
        version: (latest?.version ?? 1) + 1,
        definition,
        catalogMetadata: content.catalog,
      },
    });
    await tx.scenarioPublication.create({
      data: {
        scenarioId: scenario.id,
        draftId: id,
        draftRevision: revision,
        contentHash: contentHash(content),
        review: {
          ...(row.review as Prisma.JsonObject),
          localizations: [
            {
              locale: "en-IN",
              status: "published",
              contentHash: contentHash(content),
            },
          ],
        } as Prisma.InputJsonValue,
      },
    });
    await tx.scenarioDraft.update({
      where: { id },
      data: { status: "published" },
    });
    return { scenarioId: scenario.id };
  });
}
