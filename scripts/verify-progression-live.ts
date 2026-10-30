import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../src/lib/db";
import { hash } from "../src/lib/api";
import {
  startSession,
  sendTurn,
  sessionView,
} from "../src/lib/simulation/service";
import { CURRENT_RUNTIME } from "../src/lib/simulation/progression";
loadEnvFile(".env");
if (
  process.env.PERSONA_VERIFY_LIVE !== "1" ||
  process.env.AI_PROVIDER !== "meta" ||
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error(
    "Opt-in local Meta verification required: PERSONA_VERIFY_LIVE=1 npm run verify:progression:live",
  );
const inputs = [
  "The monthly premium is fixed at ₹1,250. What worries you most about making a claim?",
  "A 30-day initial waiting period applies except for covered accidents. Claims are assessed against policy terms and required documentation; approval is never guaranteed.",
  "Cosmetic procedures are excluded. Pre-existing conditions have a 24-month waiting period. Coverage is up to ₹5,00,000 per policy year for eligible hospitalization, subject to terms.",
  "May I send the fictional policy summary, exclusions and waiting periods so you can review before deciding? There is no pressure to purchase.",
  "Thank you. Take your time reading the exclusions and waiting periods before deciding. We can discuss any specific questions after your review.",
];
const owner = hash(`v503-live-${randomUUID()}`);
let id: string | undefined;
try {
  const created = await startSession(owner);
  id = created.sessionId;
  const questions = new Set<string>();
  let repeatedQuestions = 0;
  const phases: string[] = [];
  for (const [revision, text] of inputs.entries()) {
    const view = await sendTurn(created.branchId, owner, {
      text,
      revision,
      key: randomUUID(),
    });
    const last = view.messages.at(-1)!;
    phases.push(view.state.phase);
    for (const match of last.content.match(/[^.!?]+\?/g) ?? []) {
      const normalized = match.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
      if (questions.has(normalized)) repeatedQuestions++;
      questions.add(normalized);
    }
    console.log(
      JSON.stringify({
        turn: revision + 1,
        phase: view.state.phase,
        reply: last.content,
      }),
    );
  }
  const history = await db.message.findMany({
    where: { branchId: created.branchId, role: "assistant", turn: { gt: 0 } },
  });
  if (
    history.length !== inputs.length ||
    !history.every(
      (m) => (m.metadata as { provider?: string })?.provider === "meta",
    )
  )
    throw new Error("Live provider evidence missing.");
  const view = await sessionView(id, owner);
  if (JSON.stringify(await sessionView(id, owner)) !== JSON.stringify(view))
    throw new Error("Reload changed recorded state.");
  const snapshots = await db.stateSnapshot.findMany({
    where: { branchId: created.branchId },
  });
  if (
    !snapshots.every((s) => s.contextVersion === CURRENT_RUNTIME) ||
    phases[3] !== "next_step" ||
    phases[4] !== "next_step" ||
    repeatedQuestions !== 0
  )
    throw new Error("Progression acceptance failed.");
  await mkdir("docs/verification/v5-03", { recursive: true });
  await writeFile(
    "docs/verification/v5-03/live.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        provider: "meta",
        runtime: CURRENT_RUNTIME,
        generatedTurns: history.length,
        phases,
        repeatedLiteralQuestions: repeatedQuestions,
        exactReload: true,
        limitations:
          "Literal duplicate detection is deterministic; semantic repetition requires review of the returned fictional dialogue. This is one synthetic five-turn journey, not universal model-behavior proof.",
      },
      null,
      2,
    ) + "\n",
  );
} catch {
  console.error(
    "Live progression verification failed. No credentials or upstream error bodies were printed.",
  );
  process.exitCode = 1;
} finally {
  if (id) await db.simulationSession.delete({ where: { id } });
  await db.$disconnect();
}
