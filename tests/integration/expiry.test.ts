import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { afterAll, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import {
  startSession,
  sessionView,
  listSessions,
  sendTurn,
} from "@/lib/simulation/service";
loadEnvFile(".env");
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Expiry acceptance requires local PostgreSQL.");
afterAll(() => db.$disconnect());
it("expired practice cannot be listed, read or continued and does not commit another turn", async () => {
  vi.stubEnv("AI_PROVIDER", "mock");
  const owner = hash(`expiry-${randomUUID()}`);
  const { sessionId, branchId } = await startSession(owner);
  try {
    await db.simulationSession.update({
      where: { id: sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await listSessions(owner)).toEqual([]);
    await expect(sessionView(sessionId, owner)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      sendTurn(branchId, owner, {
        text: "Hello",
        revision: 0,
        key: randomUUID(),
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(await db.message.count({ where: { branchId } })).toBe(1);
    expect(await db.turnRequest.count({ where: { branchId } })).toBe(0);
  } finally {
    await db.simulationSession.delete({ where: { id: sessionId } });
    vi.unstubAllEnvs();
  }
});
