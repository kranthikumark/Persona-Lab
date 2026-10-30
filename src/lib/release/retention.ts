import "server-only";
import { db } from "@/lib/db";

export async function purgeExpiredSessions(batchSize = 100) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 1000)
    throw new Error("Cleanup batch size must be between 1 and 1000.");
  return db.$transaction(async (tx) => {
    // Concurrent cleanup workers claim distinct bounded batches. First detach
    // references inside each aggregate so branch/snapshot cascades can run.
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "SimulationSession"
      WHERE "expiresAt" <= timezone('UTC', NOW())
      ORDER BY "expiresAt", "id"
      LIMIT ${batchSize} FOR UPDATE SKIP LOCKED
    `;
    const ids = rows.map((row) => row.id);
    if (ids.length) {
      await tx.branch.updateMany({
        where: { sessionId: { in: ids } },
        data: { parentBranchId: null, forkSnapshotId: null },
      });
      await tx.simulationSession.deleteMany({ where: { id: { in: ids } } });
    }
    const buckets = await tx.rateLimitBucket.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    const preferences = await tx.practicePreference.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    const drafts = await tx.scenarioDraft.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return {
      deletedDrafts: drafts.count,
      deletedPreferences: preferences.count,
      deletedSessions: ids.length,
      deletedRateBuckets: buckets.count,
    };
  });
}
