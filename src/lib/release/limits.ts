import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

function admissionKey(key: string) {
  const run = process.env.PERSONA_ACCEPTANCE_RUN;
  return process.env.NODE_ENV !== "production" &&
    process.env.AI_PROVIDER === "mock" &&
    run &&
    /^[a-zA-Z0-9-]{1,64}$/.test(run)
    ? `test:${run}:${key}`
    : key;
}

// PostgreSQL admission counters are shared by all app instances. Failed provider
// attempts consume admission too; successful retry replays never reach this gate.
export async function reserveBudget(
  budgets: { key: string; limit: number; windowSeconds: number }[],
) {
  await db.$transaction(async (tx) => {
    // A stable order prevents lock inversions when callers share several budgets.
    for (const budget of [...budgets].sort((a, b) =>
      a.key.localeCompare(b.key),
    )) {
      const rows = await tx.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimitBucket" ("key", "count", "expiresAt")
        VALUES (${budget.key}, 1, timezone('UTC', NOW()) + ${budget.windowSeconds} * INTERVAL '1 second')
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= timezone('UTC', NOW())
            THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
          "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= timezone('UTC', NOW())
            THEN EXCLUDED."expiresAt" ELSE "RateLimitBucket"."expiresAt" END
        WHERE "RateLimitBucket"."expiresAt" <= timezone('UTC', NOW())
          OR "RateLimitBucket"."count" < ${budget.limit}
        RETURNING "count"
      `;
      if (!rows.length)
        throw new ApiError(
          429,
          "The studio's usage limit has been reached. Try again later.",
        );
    }
  });
}

export async function reserveGeneration(ownerHash: string) {
  const namespace = process.env.AI_PROVIDER === "mock" ? "mock" : "live";
  return reserveBudget([
    {
      key: admissionKey(`${namespace}:generation:global`),
      limit: 300,
      windowSeconds: 3600,
    },
    {
      key: admissionKey(`${namespace}:generation:owner:${ownerHash}`),
      limit: 40,
      windowSeconds: 3600,
    },
  ]);
}

export async function reserveCreation() {
  // A new cookie cannot bypass the shared creation cap.
  return reserveBudget([
    { key: admissionKey("creation:global"), limit: 100, windowSeconds: 60 },
  ]);
}
