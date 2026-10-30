import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import {
  createDraft,
  saveDraft,
  listDrafts,
  reviewDraft,
  publishDraft,
  catalogEntries,
  deleteDraft,
} from "@/lib/catalog/service";
import { initialDraft } from "@/lib/catalog/schema";
import { insuranceScenario } from "@/lib/scenarios/insurance";
import { DEFAULT_CATALOG } from "@/lib/practice/metadata";
import {
  startSession,
  sessionView,
  sendTurn,
  forkBranch,
  historyFor,
} from "@/lib/simulation/service";
import { createEvaluation } from "@/lib/evaluation/service";
import { exportData } from "@/lib/reports/data";
import { purgeExpiredSessions } from "@/lib/release/retention";
loadEnvFile(".env");
// Publication immutability is exercised in a disposable database, never by
// disabling triggers or deleting publication history in the user's database.
const url = new URL(process.env.DATABASE_URL!);
const isolated =
  process.env.PERSONA_CATALOG_TEST_DB === "1" &&
  url.pathname.startsWith("/persona_v507_test_") &&
  ["localhost", "127.0.0.1"].includes(url.hostname);
const test = isolated ? it : it.skip;
beforeAll(async () => {
  if (!isolated) return;
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("PERSONA_ACCEPTANCE_RUN", randomUUID());
  await db.scenario.create({
    data: {
      slug: insuranceScenario.slug,
      version: 1,
      definition: insuranceScenario,
      catalogMetadata: DEFAULT_CATALOG,
    },
  });
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await db.$disconnect();
});
test("private ownership, optimistic saves, invalidation and publication require a matching operator review", async () => {
  const owner = randomUUID();
  const draft = await createDraft(owner);
  expect(await listDrafts("foreign")).toEqual([]);
  await expect(
    saveDraft(draft.id, "foreign", 1, initialDraft()),
  ).rejects.toMatchObject({ status: 404 });
  await expect(deleteDraft(draft.id, "foreign")).rejects.toMatchObject({
    status: 404,
  });
  await expect(publishDraft(draft.id, 1)).rejects.toMatchObject({
    status: 409,
  });
  await reviewDraft(
    draft.id,
    1,
    "Synthetic acceptance reviewer - not human approval",
  );
  const saved = await saveDraft(draft.id, owner, 1, {
    ...initialDraft(),
    title: "Revision two",
  });
  expect(saved.revision).toBe(2);
  expect((await listDrafts(owner))[0].review).toBeNull();
  await expect(
    saveDraft(draft.id, owner, 1, initialDraft()),
  ).rejects.toMatchObject({ status: 409 });
  await expect(publishDraft(draft.id, 1)).rejects.toMatchObject({
    status: 409,
  });
  await expect(publishDraft(draft.id, 2)).rejects.toMatchObject({
    status: 409,
  });
  const review = await reviewDraft(
    draft.id,
    2,
    "Synthetic acceptance reviewer - not human approval",
  );
  expect(review.revision).toBe(2);
  const [one, two] = await Promise.all([
    publishDraft(draft.id, 2),
    publishDraft(draft.id, 2),
  ]);
  expect(one).toEqual(two);
  expect(
    await db.scenarioPublication.count({ where: { draftId: draft.id } }),
  ).toBe(1);
  await expect(
    db.scenario.update({
      where: { id: one.scenarioId },
      data: { definition: {} },
    }),
  ).rejects.toThrow();
  await expect(
    db.scenarioPublication.delete({ where: { scenarioId: one.scenarioId } }),
  ).rejects.toThrow();
  await deleteDraft(draft.id, owner);
  expect((await catalogEntries()).some((s) => s.id === one.scenarioId)).toBe(
    true,
  );
});
test("reviewed catalog versions start, turn, fork, evaluate and export without mutating a running session", async () => {
  const owner = randomUUID();
  const old = await startSession(owner);
  const before = await sessionView(old.sessionId, owner);
  const oldStored = await db.simulationSession.findUniqueOrThrow({
    where: { id: old.sessionId },
  });
  const draft = await createDraft(owner);
  const content = {
    ...initialDraft(),
    title: "Synthetic reviewed variant",
    objectives: ["Explain exclusions without promising approval"],
  };
  await saveDraft(draft.id, owner, 1, content);
  await reviewDraft(draft.id, 2, "Synthetic reviewer");
  const pub = await publishDraft(draft.id, 2);
  expect(
    (await catalogEntries()).find((s) => s.id === pub.scenarioId)?.locales,
  ).toEqual(["en-IN"]);
  expect(await sessionView(old.sessionId, owner)).toEqual(before);
  expect(
    (
      await db.simulationSession.findUniqueOrThrow({
        where: { id: old.sessionId },
      })
    ).scenarioData,
  ).toEqual(oldStored.scenarioData);
  const started = await startSession(owner, { scenarioId: pub.scenarioId });
  const view = await sessionView(started.sessionId, owner);
  expect(view.presentation.title).toBe(content.title);
  expect(view.presentation.objectives).toEqual(content.objectives);
  const turn = await sendTurn(started.branchId, owner, {
    text: "What is your monthly budget?",
    revision: 0,
    key: randomUUID(),
  });
  expect(turn.branch.revision).toBe(1);
  const child = await forkBranch(
    started.branchId,
    owner,
    view.snapshots[0].id,
    "Alternative",
  );
  expect(
    (await sessionView(started.sessionId, owner, child.branchId)).presentation
      .title,
  ).toBe(content.title);
  expect((await historyFor(started.branchId)).messages).toHaveLength(3);
  const evaluation = await createEvaluation(started.branchId, owner, 1);
  expect(evaluation.report.overall).toBeGreaterThanOrEqual(0);
  expect(
    (await exportData(started.branchId, owner, 1, evaluation.id)).title,
  ).toBe(content.title);
  await saveDraft(draft.id, owner, 2, {
    ...content,
    title: "Edited after publication",
  });
  expect((await sessionView(started.sessionId, owner)).presentation.title).toBe(
    content.title,
  );
  await expect(
    startSession(owner, {
      scenarioId: pub.scenarioId,
      practiceLocale: "te-IN",
    }),
  ).rejects.toMatchObject({ status: 422 });
  const unreviewed = await db.scenario.create({
    data: { slug: "unreviewed", version: 1, definition: insuranceScenario },
  });
  await expect(
    startSession(owner, { scenarioId: unreviewed.id }),
  ).rejects.toMatchObject({ status: 404 });
});
test("expired drafts cannot be reviewed or selected and are purged", async () => {
  const owner = randomUUID(),
    draft = await createDraft(owner);
  await db.scenarioDraft.update({
    where: { id: draft.id },
    data: { expiresAt: new Date(0) },
  });
  expect(await listDrafts(owner)).toEqual([]);
  await expect(
    reviewDraft(draft.id, 1, "Synthetic reviewer"),
  ).rejects.toMatchObject({ status: 409 });
  expect((await purgeExpiredSessions()).deletedDrafts).toBeGreaterThan(0);
});
