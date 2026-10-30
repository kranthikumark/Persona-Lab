import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { beforeEach, afterEach, afterAll, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import { localizedContent } from "@/lib/localization/content";
import {
  startSession,
  sendTurn,
  sessionView,
  forkBranch,
  historyFor,
} from "@/lib/simulation/service";
import { createEvaluation, savedEvaluation } from "@/lib/evaluation/service";
import { evaluateLocalized as frozenV4 } from "@/lib/evaluation/v4-rubric";
import { exportData } from "@/lib/reports/data";
loadEnvFile(".env");
if (
  !["127.0.0.1", "localhost"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Local database required.");
const ids: string[] = [];
let owner: string;
beforeEach(() => {
  owner = hash(`v505-${randomUUID()}`);
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("PERSONA_LOCALE_ACCEPTANCE", "1");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
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
});
afterAll(() => db.$disconnect());
for (const locale of ["hi-IN", "te-IN"] as const)
  it(`${locale}: pinned native dialogue, evaluation, exact reload and independent fork`, async () => {
    const { sessionId, branchId } = await startSession(owner, {
      practiceLocale: locale,
    });
    ids.push(sessionId);
    const opening = await sessionView(sessionId, owner);
    const pinned = (
      await db.simulationSession.findUniqueOrThrow({ where: { id: sessionId } })
    ).scenarioData as { localizedPresentation?: unknown };
    expect(pinned.localizedPresentation).toEqual(opening.presentation);
    expect("samples" in opening.presentation).toBe(false);
    expect(opening.settings.characterLocale).toBe(locale);
    expect(opening.settings.coachingLocale).toBe("en-IN");
    expect(opening.messages[0].content).toBe(localizedContent[locale].opening);
    let last = opening;
    for (const [revision, text] of localizedContent[locale].samples.entries())
      last = await sendTurn(branchId, owner, {
        text,
        revision,
        key: randomUUID(),
      });
    expect(last.messages[1].content).toBe(localizedContent[locale].samples[0]);
    expect(last.messages[1].source.originalLocale).toBe(locale);
    expect(last.messages[1].length!.validation!.locale).toBe(locale);
    expect(last.state.revealed).toContain("budgetConcern");
    expect(last.state.phase).toBe("next_step");
    expect(await sessionView(sessionId, owner)).toEqual(last);
    const oldReport = frozenV4(
      await historyFor(branchId),
      { branchId, revision: 5, forkTurn: null },
      locale,
    );
    const oldSaved = await db.evaluation.create({
      data: {
        branchId,
        branchRevision: 5,
        rubricVersion: "insurance-rubric-v4",
        findings: JSON.parse(JSON.stringify(oldReport)),
      },
    });
    const report = await createEvaluation(branchId, owner, 5);
    expect(report.id).not.toBe(oldSaved.id);
    expect(
      (await savedEvaluation(branchId, owner, oldSaved.id)).report,
    ).toEqual(oldReport);
    expect(report.report.rubricVersion).toBe("insurance-rubric-v5");
    expect(report.locales.rubricLocale).toBe(locale);
    expect(report.locales.feedbackLocale).toBe("en-IN");
    expect((await exportData(branchId, owner, 5, report.id)).locale).toBe(
      locale,
    );
    const before = await historyFor(branchId);
    const child = await forkBranch(
      branchId,
      owner,
      opening.snapshots[0].id,
      "Alternative",
    );
    const alternative = await sendTurn(child.branchId, owner, {
      text: localizedContent[locale].samples[1],
      revision: 0,
      key: randomUUID(),
    });
    expect(alternative.settings).toEqual(last.settings);
    expect(alternative.state.revealed).toEqual([]);
    expect(await historyFor(branchId)).toEqual(before);
    await expect(
      sessionView(sessionId, hash("other-browser")),
    ).rejects.toMatchObject({ status: 404 });
  });
it("does not allow native starts outside opt-in acceptance or forged mixed character settings", async () => {
  vi.stubEnv("PERSONA_LOCALE_ACCEPTANCE", "0");
  await expect(
    startSession(owner, { practiceLocale: "hi-IN" }),
  ).rejects.toMatchObject({ status: 422 });
  vi.stubEnv("PERSONA_LOCALE_ACCEPTANCE", "1");
  await expect(
    startSession(owner, { practiceLocale: "hi-IN", characterLocale: "te-IN" }),
  ).rejects.toMatchObject({ status: 422 });
  expect(
    await db.simulationSession.count({ where: { ownerHash: owner } }),
  ).toBe(0);
});
