import { branchSettings } from "@/lib/practice/server";
import {
  evaluationLocales,
  EvaluationLocalesSchema,
  LEGACY_SETTINGS,
} from "@/lib/practice/metadata";
import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { publicScenario } from "@/lib/scenarios/public";
import {
  requireBranch,
  historyFor,
  pinnedRuntime,
} from "@/lib/simulation/service";
import {
  evaluateVersion,
  validateEvidence,
  RUBRIC_VERSION,
  LOCALIZED_RUBRIC,
  LEGACY_LOCALIZED_RUBRIC,
} from "./rubric";

async function scopeFor(branchId: string, ownerHash: string | null) {
  const { branch, session } = await requireBranch(branchId, ownerHash);
  const scenario = session.scenarioData as {
    rubricVersion?: string;
    contextVersion: string;
    evaluationVersion?: string;
    slug?: string;
    version?: number;
    rubric?: Record<string, number>;
    approvedFacts?: { id: string; detail: string }[];
  };
  if (
    ![
      "insurance-rubric-v1",
      "insurance-rubric-v2",
      RUBRIC_VERSION,
      LOCALIZED_RUBRIC,
      LEGACY_LOCALIZED_RUBRIC,
    ].includes(scenario.rubricVersion ?? "") ||
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
  const runtime = pinnedRuntime(scenario);
  const evaluationVersion =
    scenario.evaluationVersion ?? runtime.evaluationVersion;
  if (
    ![
      "insurance-rubric-v1",
      "insurance-rubric-v2",
      RUBRIC_VERSION,
      LOCALIZED_RUBRIC,
      LEGACY_LOCALIZED_RUBRIC,
    ].includes(evaluationVersion)
  )
    throw new ApiError(422, "This saved evaluation version is unsupported.");
  const fork = branch.forkSnapshotId
    ? await db.stateSnapshot.findUniqueOrThrow({
        where: { id: branch.forkSnapshotId },
      })
    : null;
  return {
    branch,
    forkTurn: fork?.turnNumber ?? null,
    evaluationVersion:
      evaluationVersion === LEGACY_LOCALIZED_RUBRIC
        ? LOCALIZED_RUBRIC
        : evaluationVersion,
    locales: evaluationLocales(
      branchSettings(session.settings, branch.settings),
    ),
  };
}
async function present(
  branchId: string,
  ownerHash: string | null,
  record: {
    id: string;
    branchRevision: number;
    findings: Prisma.JsonValue;
    localeMetadata?: Prisma.JsonValue | null;
    createdAt: Date;
  },
) {
  const { branch, forkTurn, locales } = await scopeFor(branchId, ownerHash);
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
  if (
    "analysisLocale" in report &&
    report.analysisLocale !== locales.practiceLocale
  )
    throw new ApiError(422, "The report locale does not match this practice.");
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    report,
    locales: EvaluationLocalesSchema.parse(
      record.localeMetadata ?? evaluationLocales(LEGACY_SETTINGS),
    ),
    localesInferred: record.localeMetadata == null,
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
    where: {
      branchId,
      rubricVersion: {
        in: [
          "insurance-rubric-v1",
          "insurance-rubric-v2",
          RUBRIC_VERSION,
          LOCALIZED_RUBRIC,
          LEGACY_LOCALIZED_RUBRIC,
        ],
      },
    },
    orderBy: [
      { branchRevision: "desc" },
      { rubricVersion: "desc" },
      { createdAt: "desc" },
    ],
  });
  return latest ? present(branchId, ownerHash, latest) : null;
}
export async function createEvaluation(
  branchId: string,
  ownerHash: string | null,
  revision: number,
) {
  const { branch, forkTurn, evaluationVersion, locales } = await scopeFor(
    branchId,
    ownerHash,
  );
  if (branch.revision !== revision)
    throw new ApiError(409, "This path changed. Reload before evaluating it.");
  const history = await historyFor(branchId);
  const scope = { branchId, revision, forkTurn };
  const report = validateEvidence(
    evaluateVersion(evaluationVersion, history, scope, locales.practiceLocale),
    history,
    scope,
  );
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
          rubricVersion: evaluationVersion,
        },
      },
      update: {},
      create: {
        branchId,
        branchRevision: revision,
        rubricVersion: evaluationVersion,
        findings: report as unknown as Prisma.InputJsonValue,
        localeMetadata: locales,
      },
    });
  });
  return present(branchId, ownerHash, record);
}

export async function savedEvaluation(
  branchId: string,
  ownerHash: string | null,
  id: string,
) {
  await requireBranch(branchId, ownerHash);
  const record = await db.evaluation.findFirst({ where: { id, branchId } });
  if (!record) throw new ApiError(404, "Report not found on this path.");
  return present(branchId, ownerHash, record);
}
