import { test, expect } from "@playwright/test";
test("V5-01 advertises only English text and rejects future modes without creating sessions", async ({
  page,
}) => {
  const response = await page.request.get("/api/capabilities");
  expect(response.headers()["cache-control"]).toBe("no-store");
  const { capabilities } = await response.json();
  expect(capabilities.englishText.available).toBe(true);
  expect(
    Object.values(capabilities).filter(
      (c) => (c as { available: boolean }).available,
    ),
  ).toHaveLength(1);
  const headers = { origin: "http://127.0.0.1:3101" };
  const before = await (await page.request.get("/api/sessions")).json();
  for (const data of [
    { mode: "voice" },
    { practiceLocale: "hi-IN" },
    { practiceLocale: "te-IN" },
    { mode: "video" },
  ]) {
    expect(
      (await page.request.post("/api/sessions", { headers, data })).status(),
    ).toBe("practiceLocale" in data ? 422 : 400);
  }
  expect(await (await page.request.get("/api/sessions")).json()).toEqual(
    before,
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Begin practice", exact: true }),
  ).toBeEnabled();
});
