import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import type { SessionView } from "../../src/lib/client";

// Load only the database destination into this verifier; the browser never receives a Meta key.
const local = parseEnv(readFileSync(".env", "utf8"));
const db = new PrismaClient({ datasourceUrl: local.DATABASE_URL });
const phase = process.env.PERSONA_VERIFY_PHASE ?? "phase-2";
if (!/^phase-[1-8]$/.test(phase)) throw new Error("Invalid evidence phase.");
const evidenceDirectory = `docs/verification/${phase}`;
const screenshotDirectory = `docs/screenshots/${phase}`;

async function save(name: string, value: unknown) {
  await mkdir(evidenceDirectory, { recursive: true });
  await writeFile(
    `${evidenceDirectory}/${name}.json`,
    `${JSON.stringify(value, null, 2)}\n`,
  );
}
async function view(
  page: Page,
  id: string,
  branch?: string,
): Promise<SessionView> {
  const response = await page.request.get(
    `/api/sessions/${id}${branch ? `?branch=${branch}` : ""}`,
  );
  expect(response.status()).toBe(200);
  return response.json();
}
function recorded(value: SessionView) {
  return {
    messages: value.messages,
    snapshots: value.snapshots,
    events: value.events,
    state: value.state,
    revision: value.branch.revision,
  };
}
async function cleanup(
  page: Page,
  id: string,
  origin = "http://127.0.0.1:3100",
) {
  const removed = await page.request.delete(`${origin}/api/sessions/${id}`, {
    headers: { origin },
  });
  expect(removed.status()).toBe(200);
  expect(await db.simulationSession.count({ where: { id } })).toBe(0);
}
test.afterAll(async () => {
  await db.$disconnect();
});

test("real Meta: five turns, reload/resume, private knowledge, access isolation, fork and comparison", async ({
  page,
  playwright,
}) => {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(
    page.getByText("Meta · Live model", { exact: true }),
  ).toBeVisible();
  const createdResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/sessions") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Begin practice" }).first().click();
  const started = await createdResponse;
  expect(started.status()).toBe(200);
  const { sessionId: id, branchId: original } = await started.json();
  const turns: {
    turn: number;
    elapsedMs: number;
    messageId: string;
    trainee: string;
    character: string;
    revealed: string[];
  }[] = [];
  try {
    await expect(page.getByRole("log")).toContainText(
      "I've looked at a few policies",
    );
    const initial = await view(page, id);
    expect(initial.provider).toBe("meta");
    expect(initial.state.revealed).toEqual([]);
    const inputs = [
      "All claims are guaranteed.",
      "You're right: I cannot guarantee claim approval. Claims are reviewed against the terms. Let's review exclusions and waiting periods.",
      "What monthly budget would feel comfortable for you?",
      "Have you had a previous experience that makes you concerned about claims?",
      "May I send a summary of this fictional policy, including exclusions and waiting periods, for you to review before a follow-up?",
    ];
    async function send(text: string, number: number) {
      await page.getByLabel("Your response to Priya").fill(text);
      const startedAt = Date.now();
      const responsePromise = page.waitForResponse(
        (response) =>
          /\/api\/branches\/[^/]+\/turns$/.test(
            new URL(response.url()).pathname,
          ) && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Send response" }).click();
      const response = await responsePromise;
      expect(response.status()).toBe(200);
      const state: SessionView = await response.json();
      expect(state.provider).toBe("meta");
      expect(state.branch.revision).toBe(number);
      await expect(page.getByLabel("Your response to Priya")).toHaveValue("");
      const last = state.messages.at(-1)!;
      expect(last.role).toBe("assistant");
      expect(last.content.length).toBeGreaterThan(10);
      turns.push({
        turn: number,
        elapsedMs: Date.now() - startedAt,
        messageId: last.id,
        trainee: text,
        character: last.content,
        revealed: state.state.revealed,
      });
      console.log(
        `Live Meta turn ${number}: saved structured response and snapshot.`,
      );
      return state;
    }
    let five = initial;
    for (let index = 0; index < inputs.length; index++) {
      five = await send(inputs[index], index + 1);
      expect(five.messages.length).toBe(1 + (index + 1) * 2);
      expect(five.snapshots.length).toBe(index + 2);
      if (index < 2) {
        expect(five.state.revealed).toEqual([]);
        expect(
          five.messages
            .filter((message) => message.role === "assistant")
            .map((message) => message.content)
            .join(" "),
        ).not.toMatch(/1,?500|friend.{0,35}(reject|claim)/i);
      }
      if (index === 0) {
        expect(five.state.violations).toBe(1);
        expect(five.messages.at(-1)!.content).toMatch(
          /guarantee|exclu|waiting|reject|promise|terms|review|approval/i,
        );
      }
      if (index === 2) expect(five.state.revealed).toEqual(["budgetConcern"]);
      if (index === 3)
        expect(five.state.revealed).toEqual([
          "budgetConcern",
          "previousExperience",
        ]);
    }
    const beforeReload = recorded(five);
    await page.reload();
    await expect(page.getByRole("log")).toContainText(inputs[4]);
    expect(recorded(await view(page, id))).toEqual(beforeReload);
    const resumed = await send(
      "Please recap the next step we agreed on without adding any policy promises.",
      6,
    );
    expect(resumed.messages.length).toBe(13);
    expect(resumed.snapshots.length).toBe(7);
    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: `${screenshotDirectory}/live-conversation.png`,
      fullPage: true,
    });
    const outsider = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    try {
      expect((await outsider.get(`/api/sessions/${id}`)).status()).toBe(404);
      expect(
        (
          await outsider.post(`/api/branches/${original}/turns`, {
            headers: { origin: "http://127.0.0.1:3100" },
            data: {
              text: "Unauthorized test",
              key: crypto.randomUUID(),
              revision: 6,
            },
          })
        ).status(),
      ).toBe(404);
    } finally {
      await outsider.dispose();
    }
    await page
      .getByRole("button", { name: "Try another response" })
      .first()
      .click();
    await page
      .getByLabel("Name this approach")
      .fill("Live alternative · discover first");
    const forkResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/branches/${original}/forks`),
    );
    await page.getByRole("button", { name: "Create alternative path" }).click();
    const fork = await forkResponse;
    expect(fork.status()).toBe(200);
    const { branchId: alternative } = await fork.json();
    await expect(page).toHaveURL(/branch=/);
    const childInitial = await view(page, id, alternative);
    expect(childInitial.state).toEqual(initial.state);
    expect(childInitial.messages.map((message) => message.id)).toEqual(
      initial.messages.map((message) => message.id),
    );
    await expect(page.getByRole("log")).not.toContainText(inputs[0]);
    const child = await send(
      "Before I explain the policy, what concerns you most about making a claim?",
      1,
    );
    expect(child.state.violations).toBe(0);
    expect(child.state.revealed).not.toContain("budgetConcern");
    expect(recorded(await view(page, id, original))).toEqual(recorded(resumed));
    await page.getByRole("link", { name: "Compare paths" }).click();
    await expect(
      page.getByRole("heading", { name: "See what changes." }),
    ).toBeVisible();
    await expect(page.locator(".compare-column").first()).toContainText(
      inputs[0],
    );
    await expect(page.locator(".compare-column").last()).toContainText(
      "Before I explain the policy",
    );
    await expect(page.locator(".compare-column").last()).toContainText(
      "No guarantee phrase flagged",
    );
    await page.screenshot({
      path: `${screenshotDirectory}/live-comparison.png`,
      fullPage: true,
    });
    const modelMessages = await db.message.findMany({
      where: { branch: { sessionId: id }, role: "assistant", turn: { gt: 0 } },
      select: { id: true, metadata: true },
    });
    expect(modelMessages.length).toBe(7);
    for (const message of modelMessages) {
      const metadata = message.metadata as { provider: string; model: string };
      expect(metadata.provider).toBe("meta");
      expect(metadata.model).toBe(local.META_MODEL || "muse-spark-1.3");
    }
    const pinned = await db.simulationSession.findUniqueOrThrow({
      where: { id },
      select: { scenarioData: true },
    });
    expect((pinned.scenarioData as { version: number }).version).toBe(1);
    await save("live-conversation", {
      status: "passed",
      verifiedAt: new Date().toISOString(),
      environment: "local production build",
      provider: "meta",
      model: local.META_MODEL || "muse-spark-1.3",
      fictionalTrainingDataOnly: true,
      checks: {
        fiveTurns: true,
        reloadPreservedExactHistory: true,
        resumedSixthTurn: true,
        knowledgeBoundariesInTestedInputs: true,
        unauthorizedAccessDenied: true,
        independentLiveAlternative: true,
        comparisonDisplayedActualTranscripts: true,
        allSevenGeneratedResponsesHaveMetaMetadata: true,
        pinnedScenarioVersion: 1,
      },
      turns,
      originalFinalState: resumed.state,
      alternativeFinalState: child.state,
      cleanup:
        "The verification session is deleted after the test; evidence references are historical IDs.",
    });
  } finally {
    await cleanup(page, id);
  }
});

test("real Meta credential failure is recoverable and saves no partial turn", async ({
  browser,
}) => {
  const origin = "http://127.0.0.1:3102";
  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  let id: string | undefined;
  try {
    const created = await page.request.post("/api/sessions", {
      headers: { origin },
      data: {},
    });
    expect(created.status()).toBe(200);
    const ids = await created.json();
    id = ids.sessionId;
    await page.goto(`/sessions/${id}`);
    await expect(page.getByRole("log")).toContainText(
      "I've looked at a few policies",
    );
    const before = recorded(await view(page, id!));
    const draft = "Could we review the fictional policy exclusions?";
    await page.getByLabel("Your response to Priya").fill(draft);
    const failedResponse = page.waitForResponse((response) =>
      response.url().endsWith(`/api/branches/${ids.branchId}/turns`),
    );
    await page.getByRole("button", { name: "Send response" }).click();
    const failed = await failedResponse;
    expect(failed.status()).toBe(502);
    await expect(
      page.getByRole("alert").filter({ hasText: "Meta returned HTTP 401" }),
    ).toBeVisible();
    await expect(page.getByLabel("Your response to Priya")).toHaveValue(draft);
    await expect(
      page.getByRole("button", { name: "Send response" }),
    ).toBeEnabled();
    expect(recorded(await view(page, id!))).toEqual(before);
    expect(
      await db.turnRequest.count({ where: { branchId: ids.branchId } }),
    ).toBe(0);
    await page.reload();
    await expect(page.getByLabel("Your response to Priya")).toHaveValue(draft);
    await mkdir(screenshotDirectory, { recursive: true });
    // Capture the recovered draft after reload; the error was asserted before reload.
    await page.screenshot({
      path: `${screenshotDirectory}/preserved-draft.png`,
      fullPage: true,
    });
    await save("provider-failure", {
      status: "passed",
      verifiedAt: new Date().toISOString(),
      environment:
        "isolated local production server on 3102 with intentionally invalid test credential",
      upstreamStatus: 401,
      applicationStatus: 502,
      checks: {
        recoverableErrorVisible: true,
        draftRetained: true,
        draftSurvivesReload: true,
        messagesEventsSnapshotsAndRevisionUnchanged: true,
        noIdempotencyRecordCommitted: true,
        noMockFallback: true,
      },
      userApplicationConfigurationChanged: false,
    });
  } finally {
    if (id) await cleanup(page, id, origin);
    await context.close();
  }
});
