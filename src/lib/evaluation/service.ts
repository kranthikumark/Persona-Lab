import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { publicScenario } from "@/lib/scenarios/public";
import { requireBranch, historyFor } from "@/lib/simulation/service";
import { evaluate, validateEvidence, RUBRIC_VERSION } from "./rubric";

async function scopeFor(branchId: string, ownerHash: string | null) {
  const { branch, session } = await requireBranch(branchId, ownerHash);
  const scenario = session.scenarioData as {
    rubricVersion?: string;
    slug?: string;
    version?: number;
    rubric?: Record<string, number>;
    approvedFacts?: { id: string; detail: string }[];
  };
  if (
    scenario.rubricVersion !== RUBRIC_VERSION ||
    scenario.slug !== "the-trust-conversation" ||
    scenario.version !== 1 ||
    !Object.entries(publicScenario.rubric).every(
      ([key, weight]) => scenario.rubric?.[key] === weight,
    ) ||
    !publicScenario.approvedFacts.every((fact) =>
      scenario.approvedFacts?.some(
        (pinned) => pinned.id === fact.id && pinned.detail === fact.detail,
      ),
    )
  )
    throw new ApiError(
      422,
      "This saved scenario has no supported evaluation rubric.",
    );
  const fork = branch.forkSnapshotId
    ? await db.stateSnapshot.findUniqueOrThrow({
        where: { id: branch.forkSnapshotId },
      })
    : null;
  return { branch, forkTurn: fork?.turnNumber ?? null };
}
async function present(
  branchId: string,
  ownerHash: string | null,
  record: {
    id: string;
    branchRevision: number;
    findings: Prisma.JsonValue;
    createdAt: Date;
  },
) {
  const { branch, forkTurn } = await scopeFor(branchId, ownerHash);
  const reportValue = record.findings as { scope?: { throughTurn?: number } };
  const through = reportValue.scope?.throughTurn;
  if (typeof through !== "number")
    throw new ApiError(
      422,
      "This saved report format is unsupported. Evaluate this path again.",
    );
  const history = await historyFor(branchId);
  const bounded = {
    messages: history.messages.filter((m) => m.turn <= through),
    events: history.events.filter((e) => e.turn <= through),
  };
  const report = validateEvidence(record.findings, bounded, {
    branchId,
    revision: record.branchRevision,
    forkTurn,
  });
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    report,
    stale: branch.revision !== record.branchRevision,
    currentRevision: branch.revision,
  };
}
export async function latestEvaluation(
  branchId: string,
  ownerHash: string | null,
) {
  await scopeFor(branchId, ownerHash);
  const latest = await db.evaluation.findFirst({
    where: { branchId, rubricVersion: RUBRIC_VERSION },
    orderBy: [{ branchRevision: "desc" }, { createdAt: "desc" }],
  });
  return latest ? present(branchId, ownerHash, latest) : null;
}
export async function createEvaluation(
  branchId: string,
  ownerHash: string | null,
  revision: number,
) {
  const { branch, forkTurn } = await scopeFor(branchId, ownerHash);
  if (branch.revision !== revision)
    throw new ApiError(409, "This path changed. Reload before evaluating it.");
  const history = await historyFor(branchId);
  const scope = { branchId, revision, forkTurn };
  const report = validateEvidence(evaluate(history, scope), history, scope);
  const record = await db.$transaction(async (tx) => {
    // Acquire the same row lock as a turn, without changing the evaluated revision.
    const locked = await tx.branch.updateMany({
      where: { id: branchId, revision },
      data: { revision },
    });
    if (locked.count !== 1)
      throw new ApiError(
        409,
        "This path changed. Reload before evaluating it.",
      );
    return tx.evaluation.upsert({
      where: {
        branchId_branchRevision_rubricVersion: {
          branchId,
          branchRevision: revision,
          rubricVersion: RUBRIC_VERSION,
        },
      },
      update: {},
      create: {
        branchId,
        branchRevision: revision,
        rubricVersion: RUBRIC_VERSION,
        findings: report as unknown as Prisma.InputJsonValue,
      },
    });
  });
  return present(branchId, ownerHash, record);
}
