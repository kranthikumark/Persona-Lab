import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { hash } from "@/lib/api";
import { startSession, historyFor } from "@/lib/simulation/service";
import { startAvatar, endAvatar } from "@/lib/avatar/simli";
vi.mock("@/lib/speech/native-playback", () => ({
  nativePlaybackVoices: vi.fn(async () => ({ "en-IN": "Test voice" })),
}));
loadEnvFile(".env");
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL!).hostname,
  )
)
  throw new Error("Local database required");
let owner: string;
const ids: string[] = [];
beforeEach(() => {
  owner = hash(randomUUID());
  vi.stubEnv("AI_PROVIDER", "mock");
  vi.stubEnv("SIMLI_API_KEY", "synthetic-never-used");
  vi.stubEnv("SIMLI_FACE_ID", "bf13113a-355a-4d97-8b90-4edccd1da7b2");
  vi.stubEnv("PERSONA_ACCEPTANCE_RUN", randomUUID());
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("/compose/ice")
              ? [{ urls: "stun:relay.example.test:3478" }]
              : { session_token: "synthetic-session-token" },
          ),
        ),
    ),
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await db.simulationSession.deleteMany({
    where: { id: { in: ids.splice(0) } },
  });
});
afterAll(() => db.$disconnect());
it("only an owned current path can obtain a token; preview never writes a conversation turn", async () => {
  const s = await startSession(owner);
  ids.push(s.sessionId);
  const before = await historyFor(s.branchId);
  const lease = randomUUID();
  await expect(
    startAvatar(s.branchId, "foreign", 0, lease),
  ).rejects.toMatchObject({ status: 404 });
  await expect(startAvatar(s.branchId, owner, 1, lease)).rejects.toMatchObject({
    status: 409,
  });
  expect(await startAvatar(s.branchId, owner, 0, lease)).toMatchObject({
    previewSeconds: 120,
  });
  await expect(
    startAvatar(s.branchId, owner, 0, randomUUID()),
  ).rejects.toMatchObject({ status: 429 });
  await endAvatar(s.branchId, owner, randomUUID());
  await expect(
    startAvatar(s.branchId, owner, 0, randomUUID()),
  ).rejects.toMatchObject({ status: 429 });
  await endAvatar(s.branchId, owner, lease);
  const next = randomUUID();
  await startAvatar(s.branchId, owner, 0, next);
  await endAvatar(s.branchId, owner, next);
  await expect(startAvatar(s.branchId, owner, 0, randomUUID())).rejects.toThrow(
    "This browser has reached the app's limit of two video starts per hour",
  );
  expect(await historyFor(s.branchId)).toEqual(before);
});
