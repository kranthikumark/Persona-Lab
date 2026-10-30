import { verifiedVoiceSource } from "@/lib/speech/receipt";
import { speechCapabilities } from "@/lib/speech/capabilities";
import { presentationFor } from "@/lib/localization/content";
import {
  CatalogSchema,
  DEFAULT_CATALOG,
  textSource,
  effectiveMessageSource,
  SessionStartSchema,
} from "@/lib/practice/metadata";
import {
  newSettings,
  readPreferences,
  assertLocaleSettings,
  branchSettings,
  localizationContent,
  verifyLocalization,
} from "@/lib/practice/server";
import { CURRENT_RUNTIME, resolveRuntime, progressFor } from "./progression";
import {
  acceptedValidation,
  responseLength,
  lengthRecord,
} from "@/lib/response-length";
import "server-only";
import { requireTextPractice } from "@/lib/capabilities/server";
import {
  Prisma,
  type Message,
  type SimulationEvent,
  type StateSnapshot,
} from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, hash } from "@/lib/api";
import { reserveCreation, reserveGeneration } from "@/lib/release/limits";
import {
  insuranceScenario,
  type ScenarioDefinition,
} from "@/lib/scenarios/insurance";
import { characterProvider, providerMode } from "@/lib/ai/providers";
import { findings } from "./domain";

export function pinnedRuntime(scenario: { contextVersion: string }) {
  try {
    return resolveRuntime(scenario.contextVersion);
  } catch {
    throw new ApiError(
      422,
      "This saved runtime is unsupported. Your conversation has not been changed.",
    );
  }
}
function requireRuntimeLocale(
  contextVersion: string,
  locale: import("@/lib/localization/content").PracticeLocale,
) {
  if (
    (locale !== "en-IN" &&
      contextVersion !== `insurance-v1-rules-v3-${locale}`) ||
    (locale === "en-IN" && contextVersion.startsWith("insurance-v1-rules-v3-"))
  )
    throw new ApiError(
      422,
      "The saved rules do not match the pinned practice language.",
    );
}
function requireSupportedFacts(scenario: ScenarioDefinition) {
  if (
    scenario.slug !== insuranceScenario.slug ||
    scenario.version !== insuranceScenario.version ||
    scenario.approvedFacts?.length !== insuranceScenario.approvedFacts.length ||
    !insuranceScenario.approvedFacts.every((fact) =>
      scenario.approvedFacts.some(
        (pinned) => pinned.id === fact.id && pinned.detail === fact.detail,
      ),
    )
  )
    throw new ApiError(
      422,
      "These saved policy facts are incompatible with this runtime. No conversation changes were made.",
    );
}
type History = {
  messages: Message[];
  events: SimulationEvent[];
  snapshots: StateSnapshot[];
};

export async function requireSession(id: string, ownerHash: string | null) {
  if (!ownerHash) throw new ApiError(404, "Session not found on this browser.");
  const session = await db.simulationSession.findFirst({
    where: { id, ownerHash, expiresAt: { gt: new Date() } },
  });
  if (!session) throw new ApiError(404, "Session not found or expired.");
  return session;
}
export async function requireBranch(id: string, ownerHash: string | null) {
  const branch = await db.branch.findUnique({ where: { id } });
  if (!branch) throw new ApiError(404, "Branch not found.");
  const session = await requireSession(branch.sessionId, ownerHash);
  return { branch, session };
}
export async function historyFor(
  branchId: string,
  depth = 0,
): Promise<History> {
  if (depth > 12) throw new ApiError(422, "Maximum branch depth reached.");
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: branchId },
    include: {
      messages: { orderBy: { sequence: "asc" } },
      events: { orderBy: { sequence: "asc" } },
      snapshots: { orderBy: { turnNumber: "asc" } },
      forkSnapshot: true,
    },
  });
  if (!branch.parentBranchId || !branch.forkSnapshot)
    return {
      messages: branch.messages,
      events: branch.events,
      snapshots: branch.snapshots,
    };
  const parent = await historyFor(branch.parentBranchId, depth + 1);
  const turn = branch.forkSnapshot.turnNumber;
  return {
    messages: [
      ...parent.messages.filter((m) => m.turn <= turn),
      ...branch.messages,
    ],
    events: [
      ...parent.events.filter((event) => event.turn <= turn),
      ...branch.events,
    ],
    snapshots: [
      ...parent.snapshots.filter((snapshot) => snapshot.turnNumber < turn),
      ...branch.snapshots,
    ],
  };
}
export async function listSessions(ownerHash: string | null) {
  if (!ownerHash) return [];
  const rows = await db.simulationSession.findMany({
    where: { ownerHash, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      createdAt: true,
      scenarioData: true,
      branches: {
        select: { id: true, name: true, revision: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return rows.map(({ scenarioData, ...summary }) => ({
    ...summary,
    title:
      (scenarioData as unknown as ScenarioDefinition).localizedPresentation
        ?.title ?? (scenarioData as unknown as ScenarioDefinition).title,
  }));
}
export async function startSession(ownerHash: string, input: unknown = {}) {
  const { scenarioId, ...options } = SessionStartSchema.parse(input);
  requireTextPractice();
  providerMode();
  const scenario = await db.scenario.findUnique({
    where: scenarioId
      ? { id: scenarioId }
      : {
          slug_version: {
            slug: insuranceScenario.slug,
            version: insuranceScenario.version,
          },
        },
  });
  if (!scenario)
    throw new ApiError(
      503,
      "The scenario hasn't been seeded. Run npm run db:seed.",
    );
  if (scenario.version !== 1 || scenario.slug !== insuranceScenario.slug) {
    const publication = await db.scenarioPublication.findUnique({
      where: { scenarioId: scenario.id },
    });
    if (!publication) throw new ApiError(404, "Published scenario not found.");
    const locale =
      options.practiceLocale ??
      (await readPreferences(ownerHash)).practiceLocale;
    if (locale !== "en-IN")
      throw new ApiError(
        422,
        "This scenario version is reviewed for English text only. Select English to begin.",
      );
  }
  const catalog = CatalogSchema.parse(
    scenario.catalogMetadata ?? DEFAULT_CATALOG,
  );
  if (!catalog.supportedModalities.includes("text"))
    throw new ApiError(422, "This scenario does not support text practice.");
  const definition: ScenarioDefinition & { catalog: typeof catalog } = {
    ...(scenario.definition as unknown as ScenarioDefinition),
    contextVersion: CURRENT_RUNTIME,
    rubricVersion: "insurance-rubric-v3",
    evaluationVersion: "insurance-rubric-v3",
    catalog,
  };
  requireSupportedFacts(definition);
  const settings = await newSettings(
    ownerHash,
    options,
    scenario.id,
    localizationContent(definition) as unknown as Prisma.InputJsonValue,
  );
  if (settings.practiceLocale !== "en-IN") {
    definition.contextVersion = `insurance-v1-rules-v3-${settings.practiceLocale}`;
    definition.rubricVersion = "insurance-rubric-v4";
    definition.evaluationVersion = "insurance-rubric-v4";
  }
  definition.localizedPresentation =
    settings.practiceLocale === "en-IN"
      ? {
          ...presentationFor("en-IN"),
          title: definition.title,
          description: definition.description,
          objectives: [...definition.objectives],
          persona: definition.character.persona,
          opening: definition.opening,
          facts: definition.approvedFacts.map((f) => ({ ...f })),
        }
      : presentationFor(settings.practiceLocale);
  const runtime = pinnedRuntime(definition);
  const opening = definition.localizedPresentation.opening;
  await reserveCreation();
  const session = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`sessions:${ownerHash}`}))`;
    const count = await tx.simulationSession.count({
      where: { ownerHash, createdAt: { gt: new Date(Date.now() - 86400000) } },
    });
    if (count >= 20)
      throw new ApiError(429, "You have reached the daily demo session limit.");
    return tx.simulationSession.create({
      data: {
        ownerHash,
        scenarioId: scenario.id,
        settings,
        scenarioData: definition as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 30 * 86400000),
        branches: {
          create: {
            name: "Original approach",
            settings,
            messages: {
              create: {
                sequence: 0,
                turn: 0,
                role: "assistant",
                content: opening,
                metadata: { provider: "scenario", version: scenario.version },
                sourceMetadata: textSource(
                  opening,
                  settings.characterLocale,
                  "scenario",
                ),
              },
            },
            snapshots: {
              create: {
                turnNumber: 0,
                state: runtime.initialState,
                characterKnowledge: [],
                contextVersion: definition.contextVersion,
              },
            },
          },
        },
      },
      include: { branches: true },
    });
  });
  return { sessionId: session.id, branchId: session.branches[0].id };
}
export async function sessionView(
  id: string,
  ownerHash: string | null,
  selected?: string,
) {
  const session = await requireSession(id, ownerHash);
  const branches = await db.branch.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
  });
  const branch = selected
    ? branches.find((b) => b.id === selected)
    : branches[0];
  if (!branch) throw new ApiError(404, "Branch not found in this session.");
  const settings = branchSettings(session.settings, branch.settings);
  requireRuntimeLocale(
    (session.scenarioData as { contextVersion: string }).contextVersion,
    settings.practiceLocale,
  );
  const history = await historyFor(branch.id);
  const runtime = pinnedRuntime(
    session.scenarioData as unknown as ScenarioDefinition,
  );
  return {
    id: session.id,
    createdAt: session.createdAt,
    provider: providerMode(),
    legacyRules: !runtime.progression,
    settings,
    presentation:
      (session.scenarioData as unknown as ScenarioDefinition)
        .localizedPresentation ?? presentationFor(settings.practiceLocale),
    catalog: CatalogSchema.parse(
      (session.scenarioData as { catalog?: unknown }).catalog ??
        DEFAULT_CATALOG,
    ),
    branch: {
      id: branch.id,
      name: branch.name,
      revision: branch.revision,
      parentBranchId: branch.parentBranchId,
    },
    branches: branches.map(({ id, name, revision, parentBranchId }) => ({
      id,
      name,
      revision,
      parentBranchId,
    })),
    messages: history.messages.map(
      ({
        id,
        role,
        content,
        turn,
        sequence,
        branchId,
        metadata,
        sourceMetadata,
      }) => ({
        id,
        role,
        content,
        turn,
        sequence,
        inherited: branchId !== branch.id,
        length: role === "user" ? lengthRecord({ content, metadata }) : null,
        source: effectiveMessageSource(
          sourceMetadata,
          content,
          role === "user" ? settings.practiceLocale : settings.characterLocale,
          role === "user" ? "typed" : turn === 0 ? "scenario" : "model",
        ),
        sourceInferred: sourceMetadata == null,
      }),
    ),
    snapshots: history.snapshots.map(({ id, state, turnNumber }) => ({
      id,
      state: runtime.stateSchema.parse(state),
      turnNumber,
    })),
    events: history.events.map(({ id, type, turn, payload }) => ({
      id,
      type,
      turn,
      payload,
    })),
    state: runtime.stateSchema.parse(history.snapshots.at(-1)!.state),
    findings: findings(
      history.messages.map((m) => ({
        ...m,
        content: runtime.analyze(m.content),
      })),
    ),
  };
}
export async function sendTurn(
  branchId: string,
  ownerHash: string | null,
  input: {
    text: string;
    key: string;
    revision: number;
    inputModality?: "text" | "voice";
    speechReceipt?: string;
  },
) {
  const { branch, session } = await requireBranch(branchId, ownerHash);
  const inputHash =
    input.inputModality === "voice"
      ? hash(
          JSON.stringify({
            text: input.text,
            modality: "voice",
            receipt: input.speechReceipt ?? "",
          }),
        )
      : hash(input.text);
  const prior = await db.turnRequest.findUnique({
    where: { branchId_key: { branchId, key: input.key } },
  });
  if (prior) {
    const legacyWhitespaceRetry =
      input.inputModality !== "voice" &&
      !input.speechReceipt &&
      prior.inputHash !== inputHash &&
      prior.inputHash === hash(input.text.trim())
        ? await db.message.findFirst({
            where: { branchId, role: "user" },
            orderBy: { sequence: "asc" },
            skip: prior.resultRevision - 1,
          })
        : null;
    const legacy =
      legacyWhitespaceRetry?.content === input.text.trim() &&
      !(legacyWhitespaceRetry.metadata as { validation?: unknown } | null)
        ?.validation;
    if (prior.inputHash !== inputHash && !legacy)
      throw new ApiError(
        409,
        "This retry key was already used for another response.",
      );
    return sessionView(session.id, ownerHash, branchId);
  }
  if (
    input.inputModality !== undefined &&
    !["text", "voice"].includes(input.inputModality)
  )
    throw new ApiError(422, "This input modality is unavailable.");
  if (input.speechReceipt && input.inputModality !== "voice")
    throw new ApiError(422, "A speech receipt requires voice input.");
  const settings = branchSettings(session.settings, branch.settings);
  assertLocaleSettings(settings);
  requireRuntimeLocale(
    (session.scenarioData as { contextVersion: string }).contextVersion,
    settings.practiceLocale,
  );
  const admission = responseLength(input.text);
  if (admission.error) throw new ApiError(422, admission.error);
  const modality = input.inputModality ?? "text";
  if (
    modality === "voice" &&
    (settings.practiceLocale !== "en-IN" ||
      !speechCapabilities().checkAvailable)
  )
    throw new ApiError(
      422,
      "English voice dictation is unavailable here. Use keyboard text.",
    );
  const source =
    modality === "voice"
      ? verifiedVoiceSource(
          input.speechReceipt,
          ownerHash!,
          branchId,
          input.revision,
          input.text,
        )
      : textSource(input.text, settings.practiceLocale, "typed");
  const validation = acceptedValidation(
    input.text,
    settings.practiceLocale,
    modality,
  );
  if (branch.revision !== input.revision)
    throw new ApiError(
      409,
      "This conversation changed in another tab. Reload it before responding.",
    );
  if (branch.revision >= 50)
    throw new ApiError(
      429,
      "This branch has reached its 50-turn practice limit.",
    );
  const history = await historyFor(branchId);
  const latest = history.snapshots.at(-1)!;
  const scenario = session.scenarioData as unknown as ScenarioDefinition;
  await verifyLocalization(
    settings,
    session.scenarioId,
    localizationContent(scenario) as unknown as Prisma.InputJsonValue,
    scenario.localizedPresentation,
  );
  const runtime = pinnedRuntime(scenario);
  if (runtime.progression) requireSupportedFacts(scenario);
  if (latest.contextVersion !== scenario.contextVersion)
    throw new ApiError(
      422,
      "This branch's saved rules do not match its session. No turn was generated.",
    );
  const state = runtime.stateSchema.parse(latest.state);
  const progress = runtime.progression
    ? progressFor(
        history.messages.map((m) => ({
          ...m,
          content: runtime.analyze(m.content),
        })),
        runtime.analyze(input.text),
        latest.turnNumber + 1,
      )
    : undefined;
  const promptState = {
    ...state,
    revealed: runtime.revealForInput(input.text, state.revealed),
  };
  await reserveGeneration(ownerHash!);
  const generated = await characterProvider().respond({
    text: input.text,
    state: promptState,
    history: history.messages,
    scenario,
    progress,
    locale: settings.characterLocale,
    ruleText: runtime.analyze(input.text),
  });
  const result = runtime.transition(
    state,
    generated.proposal,
    input.text,
    progress,
  );
  const turn = latest.turnNumber + 1;
  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.branch.updateMany({
        where: {
          id: branchId,
          revision: input.revision,
          session: { ownerHash: ownerHash!, expiresAt: { gt: new Date() } },
        },
        data: { revision: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new ApiError(
          409,
          "Another response finished first. Reload the conversation.",
        );
      const message = await tx.message.create({
        data: {
          branchId,
          sequence: turn * 2 - 1,
          turn,
          role: "user",
          content: input.text,
          metadata: { validation },
          sourceMetadata: source,
        },
      });
      await tx.message.create({
        data: {
          branchId,
          sequence: turn * 2,
          turn,
          role: "assistant",
          content: generated.proposal.utterance,
          metadata: generated.metadata,
          sourceMetadata: textSource(
            generated.proposal.utterance,
            settings.characterLocale,
            "model",
          ),
        },
      });
      await tx.simulationEvent.create({
        data: {
          branchId,
          sequence: turn,
          turn,
          type: result.violation
            ? "POLICY_GUARANTEE_FLAGGED"
            : "TURN_COMMITTED",
          payload: {
            messageId: message.id,
            newlyRevealed: result.newlyRevealed,
            ruleVersion: scenario.contextVersion,
            ...(progress ? { progress } : {}),
          },
        },
      });
      await tx.stateSnapshot.create({
        data: {
          branchId,
          turnNumber: turn,
          state: result.state,
          characterKnowledge: result.state.revealed,
          contextVersion: scenario.contextVersion,
        },
      });
      await tx.turnRequest.create({
        data: {
          branchId,
          key: input.key,
          inputHash,
          resultRevision: input.revision + 1,
        },
      });
    });
  } catch (error) {
    const committed = await db.turnRequest.findUnique({
      where: { branchId_key: { branchId, key: input.key } },
    });
    if (!committed || committed.inputHash !== inputHash) throw error;
  }
  return sessionView(session.id, ownerHash, branchId);
}
export async function forkBranch(
  branchId: string,
  ownerHash: string | null,
  snapshotId: string,
  name: string,
) {
  const { session, branch: sourceBranch } = await requireBranch(
    branchId,
    ownerHash,
  );
  branchSettings(session.settings, sourceBranch.settings);
  const history = await historyFor(branchId);
  const snapshot = history.snapshots.find((s) => s.id === snapshotId);
  if (!snapshot)
    throw new ApiError(404, "Snapshot not found in this branch's history.");
  pinnedRuntime(session.scenarioData as unknown as ScenarioDefinition);
  if (
    snapshot.contextVersion !==
    (session.scenarioData as { contextVersion: string }).contextVersion
  )
    throw new ApiError(422, "This snapshot has incompatible saved rules.");
  const branch = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`branches:${session.id}`}))`;
    const count = await tx.branch.count({ where: { sessionId: session.id } });
    if (count >= 10)
      throw new ApiError(429, "This session supports up to 10 branches.");
    return tx.branch.create({
      data: {
        sessionId: session.id,
        parentBranchId: branchId,
        settings:
          sourceBranch.settings == null
            ? Prisma.DbNull
            : (sourceBranch.settings as Prisma.InputJsonValue),
        forkSnapshotId: snapshot.id,
        name,
        snapshots: {
          create: {
            turnNumber: snapshot.turnNumber,
            state: snapshot.state as Prisma.InputJsonValue,
            characterKnowledge:
              snapshot.characterKnowledge as Prisma.InputJsonValue,
            contextVersion: snapshot.contextVersion,
          },
        },
      },
    });
  });
  return { sessionId: session.id, branchId: branch.id };
}
