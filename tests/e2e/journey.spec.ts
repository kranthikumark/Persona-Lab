import { test, expect } from "@playwright/test";
test("practice, persist, revisit a decision and compare both paths", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Better conversations/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Begin practice" }).first().click();
  await expect(page).toHaveURL(/\/sessions\//);
  await expect(page.getByRole("log")).toContainText(
    "I've looked at a few policies",
  );
  await expect(
    page.getByRole("button", { name: "Send response" }),
  ).toBeInViewport();
  const prompts = [
    "All claims are guaranteed.",
    "What is your budget?",
    "What was your past experience?",
    "There are exclusions and waiting periods.",
    "Can I send a summary for review?",
  ];
  for (const text of prompts) {
    await page.getByLabel("Your response to Priya").fill(text);
    await page.getByRole("button", { name: "Send response" }).click();
    await expect(page.getByLabel("Your response to Priya")).toHaveValue("");
  }
  const originalUrl = page.url();
  await page.reload();
  await expect(page.getByRole("log")).toContainText(
    "All claims are guaranteed.",
  );
  await expect(page.getByRole("log")).toContainText(
    "Can I send a summary for review?",
  );
  await page
    .getByRole("button", { name: "Try another response" })
    .first()
    .click();
  await page.getByLabel("Name this approach").fill("Explain the limits");
  await page.getByRole("button", { name: "Create alternative path" }).click();
  await expect(page).toHaveURL(/branch=/);
  await expect(page.getByRole("log")).not.toContainText(
    "All claims are guaranteed.",
  );
  await page
    .getByLabel("Your response to Priya")
    .fill(
      "Claims are reviewed, not guaranteed. Can we discuss the exclusions?",
    );
  await page.getByRole("button", { name: "Send response" }).click();
  await expect(page.getByLabel("Your response to Priya")).toHaveValue("");
  await page.getByRole("link", { name: "Compare paths" }).click();
  await expect(
    page.getByRole("heading", { name: "See what changes." }),
  ).toBeVisible();
  await expect(page.locator(".compare-column").first()).toContainText(
    "Unsupported claim guarantee",
  );
  await expect(page.locator(".compare-column").nth(1)).toContainText(
    "No guarantee phrase flagged",
  );
  await page.goto(originalUrl);
  await expect(page.getByRole("log")).toContainText(
    "All claims are guaranteed.",
  );
  await expect(page.getByRole("log")).not.toContainText(
    "Claims are reviewed, not guaranteed.",
  );
});

test("API enforces access, idempotency, concurrency and fork isolation", async ({
  playwright,
}) => {
  const owner = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3101",
    extraHTTPHeaders: { origin: "http://127.0.0.1:3101" },
  });
  const outsider = await playwright.request.newContext({
    baseURL: "http://127.0.0.1:3101",
    extraHTTPHeaders: { origin: "http://127.0.0.1:3101" },
  });
  const started = await owner.post("/api/sessions", { data: {} });
  expect(started.ok()).toBe(true);
  const ids = await started.json();
  try {
    expect(
      (await outsider.get(`/api/sessions/${ids.sessionId}`)).status(),
    ).toBe(404);
    const initial = await (
      await owner.get(`/api/sessions/${ids.sessionId}`)
    ).json();
    expect(JSON.stringify(initial)).not.toContain("privateKnowledge");
    expect(JSON.stringify(initial)).not.toContain("1,500");
    const key = crypto.randomUUID();
    const input = { text: "All claims are guaranteed.", key, revision: 0 };
    const first = await owner.post(`/api/branches/${ids.branchId}/turns`, {
      data: input,
    });
    expect(first.ok()).toBe(true);
    const retry = await owner.post(`/api/branches/${ids.branchId}/turns`, {
      data: input,
    });
    expect(retry.ok()).toBe(true);
    expect((await retry.json()).messages.length).toBe(3);
    expect(
      (
        await owner.post(`/api/branches/${ids.branchId}/turns`, {
          data: { ...input, text: "different" },
        })
      ).status(),
    ).toBe(409);
    const concurrent = await Promise.all(
      ["Ask about budget?", "Explain exclusions?"].map((text) =>
        owner.post(`/api/branches/${ids.branchId}/turns`, {
          data: { text, key: crypto.randomUUID(), revision: 1 },
        }),
      ),
    );
    expect(concurrent.map((r) => r.status()).sort()).toEqual([200, 409]);
    const parent = await (
      await owner.get(`/api/sessions/${ids.sessionId}`)
    ).json();
    const forked = await (
      await owner.post(`/api/branches/${ids.branchId}/forks`, {
        data: { snapshotId: initial.snapshots[0].id, name: "Alternative" },
      })
    ).json();
    expect(
      (
        await outsider.post(`/api/branches/${forked.branchId}/turns`, {
          data: { ...input, revision: 0 },
        })
      ).status(),
    ).toBe(404);
    const childTurn = await owner.post(
      `/api/branches/${forked.branchId}/turns`,
      {
        data: {
          text: "Let's review exclusions.",
          key: crypto.randomUUID(),
          revision: 0,
        },
      },
    );
    expect(childTurn.ok()).toBe(true);
    const child = await childTurn.json();
    expect(child.messages[0].id).toBe(initial.messages[0].id);
    expect(child.state.violations).toBe(0);
    const unchanged = await (
      await owner.get(`/api/sessions/${ids.sessionId}`)
    ).json();
    expect(unchanged.messages).toEqual(parent.messages);
    expect(unchanged.state).toEqual(parent.state);
    expect(unchanged.events).toEqual(parent.events);
    const csrf = await owner.post("/api/sessions", {
      data: {},
      headers: { origin: "https://wrong.example" },
    });
    expect(csrf.status()).toBe(403);
  } finally {
    expect((await owner.delete(`/api/sessions/${ids.sessionId}`)).ok()).toBe(
      true,
    );
    await owner.dispose();
    await outsider.dispose();
  }
});

test("scenario studio and practice adapt to a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Begin practice" }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Begin practice" }).first().click();
  await expect(page.getByLabel("Your response to Priya")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
