import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { hash } from "../src/lib/api";
import {
  startSession,
  sendTurn,
  sessionView,
  forkBranch,
  historyFor,
} from "../src/lib/simulation/service";
import { createEvaluation } from "../src/lib/evaluation/service";
import { localizedContent } from "../src/lib/localization/content";
loadEnvFile(".env");
const localDatabase = (() => {
  try {
    return ["localhost", "127.0.0.1"].includes(
      new URL(process.env.DATABASE_URL ?? "").hostname,
    );
  } catch {
    return false;
  }
})();
if (
  process.env.PERSONA_VERIFY_LOCALES !== "1" ||
  process.env.AI_PROVIDER !== "meta" ||
  process.env.NODE_ENV === "production" ||
  !localDatabase
)
  throw new Error(
    "Opt-in local Meta verification required: PERSONA_VERIFY_LOCALES=1 npm run verify:locales:live",
  );
process.env.PERSONA_LOCALE_ACCEPTANCE = "1";
const ids: string[] = [];
try {
  await mkdir("docs/verification/v5-05", { recursive: true });
  for (const locale of ["hi-IN", "te-IN"] as const) {
    const owner = hash(`v505-live-${locale}-${randomUUID()}`);
    const created = await startSession(owner, { practiceLocale: locale });
    ids.push(created.sessionId);
    const opening = await sessionView(created.sessionId, owner);
    let view = opening;
    const questions = new Set<string>();
    let repeats = 0;
    for (const [revision, text] of localizedContent[locale].samples.entries()) {
      view = await sendTurn(created.branchId, owner, {
        text,
        revision,
        key: randomUUID(),
      });
      const reply = view.messages.at(-1)!.content;
      const script =
        locale === "hi-IN" ? /\p{Script=Devanagari}/gu : /\p{Script=Telugu}/gu;
      const ratio =
        (reply.match(script)?.length ?? 0) /
        Math.max(1, reply.match(/\p{L}/gu)?.length ?? 0);
      if (ratio < 0.6)
        throw new Error("Reply did not remain in the pinned script.");
      for (const q of reply.match(/[^.!?।]+\?/gu) ?? []) {
        const normalized = q.replace(/[^\p{L}\p{N}]/gu, "");
        if (questions.has(normalized)) repeats++;
        questions.add(normalized);
      }
      console.log(
        JSON.stringify({
          locale,
          turn: revision + 1,
          phase: view.state.phase,
          reply,
        }),
      );
    }
    if (
      view.state.phase !== "next_step" ||
      JSON.stringify(await sessionView(created.sessionId, owner)) !==
        JSON.stringify(view)
    )
      throw new Error("Progression/reload failed.");
    const original = await historyFor(created.branchId);
    const child = await forkBranch(
      created.branchId,
      owner,
      opening.snapshots[0].id,
      "Native alternative",
    );
    const alternate =
      locale === "hi-IN"
        ? "आपका बजट कितना है? आपका पिछला दावा अनुभव क्या था?"
        : "మీ బడ్జెట్ ఎంత? మీ గత క్లెయిమ్ అనుభవం ఏమిటి?";
    const alternative = await sendTurn(child.branchId, owner, {
      text: alternate,
      key: randomUUID(),
      revision: 0,
    });
    const alternativeReply = alternative.messages.at(-1)!.content;
    const alternativeScript =
      locale === "hi-IN" ? /\p{Script=Devanagari}/gu : /\p{Script=Telugu}/gu;
    if (
      (alternativeReply.match(alternativeScript)?.length ?? 0) /
        Math.max(1, alternativeReply.match(/\p{L}/gu)?.length ?? 0) <
      0.6
    )
      throw new Error("Alternative reply changed script.");
    if (
      JSON.stringify(await historyFor(created.branchId)) !==
        JSON.stringify(original) ||
      alternative.settings.practiceLocale !== locale
    )
      throw new Error("Independent branch verification failed.");
    const report = await createEvaluation(created.branchId, owner, 5);
    const generated = await db.message.findMany({
      where: {
        branch: { sessionId: created.sessionId },
        role: "assistant",
        turn: { gt: 0 },
      },
    });
    if (
      generated.length !== 6 ||
      !generated.every(
        (m) => (m.metadata as { provider?: string })?.provider === "meta",
      )
    )
      throw new Error("Live provider provenance failed.");
    await writeFile(
      `docs/verification/v5-05/live-${locale}.json`,
      JSON.stringify(
        {
          date: new Date().toISOString(),
          locale,
          provider: "meta",
          originalTurns: 5,
          independentAlternativeTurns: 1,
          nativeScriptVerified: true,
          alternativeScriptVerified: true,
          exactReload: true,
          parentTraceUnchanged: true,
          settingsInherited: true,
          rubric: report.report.rubricVersion,
          coachingFallback: "en-IN",
          literalDuplicateQuestions: repeats,
          nativeHumanReview: "pending",
          exportRenderingAcceptance: "pending V5-06",
          limitations:
            "One synthetic journey; script detection is not native-speaker review or exhaustive semantic/factual validation.",
        },
        null,
        2,
      ) + "\n",
    );
    await db.$transaction(async (tx) => {
      await tx.branch.updateMany({
        where: { sessionId: created.sessionId },
        data: { parentBranchId: null, forkSnapshotId: null },
      });
      await tx.simulationSession.delete({ where: { id: created.sessionId } });
    });
    ids.splice(ids.indexOf(created.sessionId), 1);
  }
} catch {
  console.error(
    "Live locale verification failed. No credentials or upstream bodies were printed.",
  );
  process.exitCode = 1;
} finally {
  for (const id of ids) {
    await db.branch.updateMany({
      where: { sessionId: id },
      data: { parentBranchId: null, forkSnapshotId: null },
    });
    await db.simulationSession.delete({ where: { id } });
  }
  await db.$disconnect();
}
