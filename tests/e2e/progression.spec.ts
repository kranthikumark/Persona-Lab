import { test, expect } from "@playwright/test";
const headers = { origin: "http://127.0.0.1:3101" };
test("V5-03: clarification, natural progression, exact reload and independent rewind", async ({
  page,
}) => {
  const { sessionId, branchId } = await (
    await page.request.post("/api/sessions", { headers, data: {} })
  ).json();
  try {
    await page.goto(`/sessions/${sessionId}`);
    await expect(
      page.getByText(
        "This saved conversation uses earlier progression rules.",
        { exact: false },
      ),
    ).not.toBeVisible();
    const input = page.getByRole("textbox", { name: "Your response to Priya" });
    const send = async (text: string) => {
      await input.fill(text);
      await page
        .getByRole("button", { name: "Send response", exact: true })
        .click();
      await expect(input).toHaveValue("");
    };
    await send("We can review policy documents together. What concerns you?");
    let view = await (
      await page.request.get(`/api/sessions/${sessionId}`)
    ).json();
    expect(view.state.phase).toBe("discovery");
    const initialSnapshot = view.snapshots[0].id;
    await send(
      "The monthly premium is fixed at ₹1,250. A 30-day waiting period applies.",
    );
    view = await (await page.request.get(`/api/sessions/${sessionId}`)).json();
    expect(view.state.phase).toBe("clarification");
    expect(view.messages.at(-1).content).not.toContain("monthly premium");
    await send(
      "May I send a policy summary for you to review before deciding?",
    );
    await send(
      "Thank you. Reading the exclusions before deciding is wise. Take care.",
    );
    const saved = await (
      await page.request.get(`/api/sessions/${sessionId}`)
    ).json();
    expect(saved.state.phase).toBe("next_step");
    await page.reload();
    await expect(page.getByRole("log")).toContainText(
      "Thank you. I'll consider the written terms before deciding.",
    );
    expect(
      await (await page.request.get(`/api/sessions/${sessionId}`)).json(),
    ).toEqual(saved);
    const child = await (
      await page.request.post(`/api/branches/${branchId}/forks`, {
        headers,
        data: { snapshotId: initialSnapshot, name: "Another approach" },
      })
    ).json();
    await page.goto(`/sessions/${sessionId}?branch=${child.branchId}`);
    await expect(page.getByRole("log")).not.toContainText(
      "monthly premium is fixed",
    );
    const alternative = await (
      await page.request.get(
        `/api/sessions/${sessionId}?branch=${child.branchId}`,
      )
    ).json();
    expect(alternative.state.phase).toBe("discovery");
    const rootAfterFork = await (
      await page.request.get(`/api/sessions/${sessionId}`)
    ).json();
    for (const field of ["branch", "messages", "snapshots", "events", "state"])
      expect(rootAfterFork[field]).toEqual(saved[field]);
    expect(rootAfterFork.branches).toHaveLength(2);
  } finally {
    expect(
      (
        await page.request.delete(`/api/sessions/${sessionId}`, { headers })
      ).ok(),
    ).toBe(true);
  }
});
