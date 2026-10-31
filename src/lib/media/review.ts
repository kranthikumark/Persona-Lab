import "server-only";
import type { Prisma } from "@prisma/client";
import { ApiError, hash } from "@/lib/api";
import { DraftContentSchema } from "@/lib/catalog/schema";
export const transcriptHash = (
  text: string,
  translation: string | null,
  locale: string,
) => hash(JSON.stringify({ text, translation, locale }));
export async function reviewedSources(
  tx: Prisma.TransactionClient,
  draft: { id: string; ownerHash: string; content: unknown },
) {
  const content = DraftContentSchema.parse(draft.content),
    refs = content.sources ?? [];
  const assets = await tx.scenarioSourceAsset.findMany({
    where: { draftId: draft.id, ownerHash: draft.ownerHash },
  });
  if (
    assets.some((a) => a.status !== "reviewed" || a.expiresAt <= new Date()) ||
    refs.length !== assets.length
  )
    throw new ApiError(
      409,
      "Review and attach every source transcript, or delete unused/expired sources, before operator review and publication.",
    );
  const sources = [];
  for (const ref of refs) {
    const asset = assets.find((a) => a.id === ref.assetId);
    const transcript =
      asset &&
      (await tx.sourceTranscript.findUnique({
        where: {
          assetId_version: {
            assetId: asset.id,
            version: ref.transcriptVersion,
          },
        },
      }));
    if (
      !asset ||
      !transcript?.reviewedAt ||
      transcriptHash(
        transcript.text,
        transcript.translation,
        transcript.locale,
      ) !== ref.transcriptHash
    )
      throw new ApiError(
        409,
        "Source review does not match this draft. Review the current transcript again.",
      );
    sources.push({
      assetId: asset.id,
      kind: asset.kind,
      locale: asset.locale,
      sha256: asset.sha256,
      durationMs: asset.durationMs,
      transcriptVersion: transcript.version,
      transcriptHash: ref.transcriptHash,
      reviewedAt: transcript.reviewedAt.toISOString(),
      availability: "private_deletable_source",
    });
  }
  return sources;
}
