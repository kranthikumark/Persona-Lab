import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import {
  startSession,
  sessionView,
  sendTurn,
  forkBranch,
  historyFor,
} from "@/lib/simulation/service";
import { createEvaluation } from "@/lib/evaluation/service";
import { readPreferences, savePreferences } from "@/lib/practice/server";
import { DEFAULT_PREFERENCES } from "@/lib/practice/metadata";
import { mockProvider } from "@/lib/ai/providers";
import { purgeExpiredSessions } from "@/lib/release/retention";
loadEnvFile(".env");
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Local database required.");
let owner: string;
const ids: string[] = [];
beforeEach(() => {
  owner = hash(`v504-${randomUUID()}`);
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("PERSONA_ACCEPTANCE_RUN", randomUUID());
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await db.branch.updateMany({
    where: { sessionId: { in: ids } },
    data: { parentBranchId: null, forkSnapshotId: null },
  });
  await db.simulationSession.deleteMany({
    where: { id: { in: ids.splice(0) } },
  });
  await db.practicePreference.deleteMany({ where: { ownerHash: owner } });
});
afterAll(() => db.$disconnect());
async function create() {
  const created = await startSession(owner);
  ids.push(created.sessionId);
  return created;
}
it("pins localization/settings, preserves raw source and copies them exactly through forks", async () => {
  const { sessionId, branchId } = await create();
  const initial = await sessionView(sessionId, owner);
  expect(initial.settings).toMatchObject({
    ...DEFAULT_PREFERENCES,
    localization: {
      locale: "en-IN",
      version: 1,
      source: "versioned_baseline",
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    },
  });
  const raw = "  English हिन्दी తెలుగు 🙂  ";
  const parent = await sendTurn(branchId, owner, {
    text: raw,
    revision: 0,
    key: randomUUID(),
    inputModality: "text",
  });
  expect(parent.messages[1].source).toMatchObject({
    originalText: raw,
    modality: "text",
    originalLocale: "en-IN",
    provenance: "typed",
  });
  expect(parent.messages[1].sourceInferred).toBe(false);
  const child = await forkBranch(
    branchId,
    owner,
    parent.snapshots.at(-1)!.id,
    "Inherited settings",
  );
  const alternative = await sessionView(sessionId, owner, child.branchId);
  expect(alternative.settings).toEqual(parent.settings);
  expect(alternative.messages[1].source).toEqual(parent.messages[1].source);
  const branch = await db.branch.findUniqueOrThrow({
    where: { id: child.branchId },
  });
  expect(branch.settings).toEqual(
    (await db.simulationSession.findUniqueOrThrow({ where: { id: sessionId } }))
      .settings,
  );
  const report = await createEvaluation(child.branchId, owner, 0);
  expect(report.locales).toMatchObject({
    rubricLocale: "en-IN",
    feedbackLocale: "en-IN",
    localization: parent.settings.localization,
  });
  expect(report.localesInferred).toBe(false);
});
it("reads legacy rows as English without writing their messages, snapshots or reports", async () => {
  const { sessionId, branchId } = await create();
  await db.simulationSession.update({
    where: { id: sessionId },
    data: { settings: Prisma.DbNull },
  });
  await db.branch.update({
    where: { id: branchId },
    data: { settings: Prisma.DbNull },
  });
  await db.message.updateMany({
    where: { branchId },
    data: { sourceMetadata: Prisma.DbNull },
  });
  const before = await historyFor(branchId);
  const view = await sessionView(sessionId, owner);
  expect(view.settings.practiceLocale).toBe("en-IN");
  expect(view.settings.localization.source).toBe("embedded_legacy");
  expect(view.messages[0].sourceInferred).toBe(true);
  expect(await historyFor(branchId)).toEqual(before);
  const child = await forkBranch(
    branchId,
    owner,
    view.snapshots[0].id,
    "Legacy child",
  );
  expect(
    (await db.branch.findUniqueOrThrow({ where: { id: child.branchId } }))
      .settings,
  ).toBeNull();
  expect(
    (await sessionView(sessionId, owner, child.branchId)).settings,
  ).toEqual(view.settings);
});
it("isolates preferences by browser ownership and never changes an existing practice", async () => {
  expect(await readPreferences(owner)).toEqual(DEFAULT_PREFERENCES);
  const { sessionId } = await create();
  const before = await sessionView(sessionId, owner);
  await savePreferences(owner, { coachingLocale: "en-IN" });
  expect(await readPreferences(hash("other-browser"))).toEqual(
    DEFAULT_PREFERENCES,
  );
  expect(
    await db.practicePreference.findUnique({
      where: { ownerHash: hash("other-browser") },
    }),
  ).toBeNull();
  await expect(
    savePreferences(owner, { practiceLocale: "hi-IN" }),
  ).rejects.toThrow();
  expect(await sessionView(sessionId, owner)).toEqual(before);
  const preference = await db.practicePreference.findUniqueOrThrow({
    where: { ownerHash: owner },
  });
  expect(preference.settings).toEqual(DEFAULT_PREFERENCES);
  await db.practicePreference.update({
    where: { ownerHash: owner },
    data: { expiresAt: new Date(0) },
  });
  expect(await readPreferences(owner)).toEqual(DEFAULT_PREFERENCES);
  const purged = await purgeExpiredSessions();
  expect(purged.deletedPreferences).toBeGreaterThanOrEqual(1);
  expect(
    await db.practicePreference.findUnique({ where: { ownerHash: owner } }),
  ).toBeNull();
});
it("rejects mismatched pins and forged media before provider calls or turn writes", async () => {
  const { sessionId, branchId } = await create();
  const before = await historyFor(branchId);
  const respond = vi.spyOn(mockProvider, "respond");
  await expect(
    sendTurn(branchId, owner, {
      text: "Hello",
      revision: 0,
      key: randomUUID(),
      inputModality: "voice" as "text",
    }),
  ).rejects.toMatchObject({ status: 422 });
  await db.branch.update({
    where: { id: branchId },
    data: { settings: Prisma.DbNull },
  });
  await expect(
    sendTurn(branchId, owner, {
      text: "Hello",
      revision: 0,
      key: randomUUID(),
    }),
  ).rejects.toMatchObject({ status: 422 });
  expect(respond).not.toHaveBeenCalled();
  expect(await historyFor(branchId)).toEqual(before);
  expect(await db.turnRequest.count({ where: { branchId } })).toBe(0);
  expect(
    (await db.simulationSession.findUniqueOrThrow({ where: { id: sessionId } }))
      .settings,
  ).not.toBeNull();
});
it("keeps localization revisions immutable at the database boundary", async () => {
  const { sessionId } = await create();
  const view = await sessionView(sessionId, owner);
  const id = view.settings.localization.id!;
  const before = await db.scenarioLocalization.findUniqueOrThrow({
    where: { id },
  });
  await expect(
    db.scenarioLocalization.update({ where: { id }, data: { content: {} } }),
  ).rejects.toThrow();
  await expect(
    db.scenarioLocalization.delete({ where: { id } }),
  ).rejects.toThrow();
  expect(
    await db.scenarioLocalization.findUniqueOrThrow({ where: { id } }),
  ).toEqual(before);
});
