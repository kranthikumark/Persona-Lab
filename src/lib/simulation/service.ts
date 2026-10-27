import "server-only";
import {
  Prisma,
  type Message,
  type SimulationEvent,
  type StateSnapshot,
} from "@prisma/client";
import { db } from "@/lib/db";
import { ApiError, hash } from "@/lib/api";
import {
  insuranceScenario,
  type ScenarioDefinition,
} from "@/lib/scenarios/insurance";
import { characterProvider, providerMode } from "@/lib/ai/providers";
import {
  StateSchema,
  initialState,
  transition,
  revealForInput,
  findings,
} from "./domain";

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
async function requireBranch(id: string, ownerHash: string | null) {
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
  return db.simulationSession.findMany({
    where: { ownerHash, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      createdAt: true,
      branches: {
        select: { id: true, name: true, revision: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
}
export async function startSession(ownerHash: string) {
  const count = await db.simulationSession.count({
    where: { ownerHash, createdAt: { gt: new Date(Date.now() - 86400000) } },
  });
  if (count >= 20)
    throw new ApiError(429, "You have reached the daily demo session limit.");
  providerMode();
  const scenario = await db.scenario.findUnique({
    where: {
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
  const definition = scenario.definition as unknown as ScenarioDefinition;
  const session = await db.simulationSession.create({
    data: {
      ownerHash,
      scenarioId: scenario.id,
      scenarioData: scenario.definition as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + 30 * 86400000),
      branches: {
        create: {
          name: "Original approach",
          messages: {
            create: {
              sequence: 0,
              turn: 0,
              role: "assistant",
              content: definition.opening,
              metadata: { provider: "scenario", version: scenario.version },
            },
          },
          snapshots: {
            create: {
              turnNumber: 0,
              state: initialState,
              characterKnowledge: [],
              contextVersion: definition.contextVersion,
            },
          },
        },
      },
    },
    include: { branches: true },
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
  const history = await historyFor(branch.id);
  return {
    id: session.id,
    createdAt: session.createdAt,
    provider: providerMode(),
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
      ({ id, role, content, turn, sequence, branchId }) => ({
        id,
        role,
        content,
        turn,
        sequence,
        inherited: branchId !== branch.id,
      }),
    ),
    snapshots: history.snapshots.map(({ id, state, turnNumber }) => ({
      id,
      state: StateSchema.parse(state),
      turnNumber,
    })),
    events: history.events.map(({ id, type, turn, payload }) => ({
      id,
      type,
      turn,
      payload,
    })),
    state: StateSchema.parse(history.snapshots.at(-1)!.state),
    findings: findings(history.messages),
  };
}
export async function sendTurn(
  branchId: string,
  ownerHash: string | null,
  input: { text: string; key: string; revision: number },
) {
  const { branch, session } = await requireBranch(branchId, ownerHash);
  const inputHash = hash(input.text);
  const prior = await db.turnRequest.findUnique({
    where: { branchId_key: { branchId, key: input.key } },
  });
  if (prior) {
    if (prior.inputHash !== inputHash)
      throw new ApiError(
        409,
        "This retry key was already used for another response.",
      );
    return sessionView(session.id, ownerHash, branchId);
  }
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
  const state = StateSchema.parse(latest.state);
  const scenario = session.scenarioData as unknown as ScenarioDefinition;
  const promptState = {
    ...state,
    revealed: revealForInput(input.text, state.revealed),
  };
  const generated = await characterProvider().respond({
    text: input.text,
    state: promptState,
    history: history.messages,
    scenario,
  });
  const result = transition(state, generated.proposal, input.text);
  const turn = latest.turnNumber + 1;
  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.branch.updateMany({
        where: { id: branchId, revision: input.revision },
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
  const { session } = await requireBranch(branchId, ownerHash);
  const history = await historyFor(branchId);
  const snapshot = history.snapshots.find((s) => s.id === snapshotId);
  if (!snapshot)
    throw new ApiError(404, "Snapshot not found in this branch's history.");
  const count = await db.branch.count({ where: { sessionId: session.id } });
  if (count >= 10)
    throw new ApiError(429, "This session supports up to 10 branches.");
  const branch = await db.branch.create({
    data: {
      sessionId: session.id,
      parentBranchId: branchId,
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
  return { sessionId: session.id, branchId: branch.id };
}
