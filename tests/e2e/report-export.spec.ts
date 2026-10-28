import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import AxeBuilder from "@axe-core/playwright";
const headers = { origin: "http://127.0.0.1:3101" };

test("PDF and Word downloads are owned, revision-bound and ready for native sharing or honest fallbacks", async ({
  page,
  playwright,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { shared: string[] }).shared = (
          data.files ?? []
        ).map((f) => f.name);
      },
    });
  });
  const created = await page.request.post("/api/sessions", {
    headers,
    data: {},
  });
  const { sessionId, branchId } = await created.json();
  const endpoint = `/api/branches/${branchId}/evaluation/export`;
  try {
    expect(
      (
        await page.request.post(`/api/branches/${branchId}/turns`, {
          headers,
          data: {
            text: "All claims are guaranteed.",
            revision: 0,
            key: crypto.randomUUID(),
          },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/sessions/${sessionId}`);
    await page.getByRole("button", { name: /Field notes/ }).click();
    for (const [name, extension] of [
      ["Download PDF", "pdf"],
      ["Download Word", "docx"],
    ]) {
      const pending = page.waitForEvent("download");
      await page.getByRole("button", { name, exact: true }).click();
      const file = await pending;
      expect(file.suggestedFilename()).toBe(
        `persona-lab-report-r1.${extension}`,
      );
      const bytes = await readFile((await file.path())!);
      if (extension === "pdf") {
        expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
        expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(
          1,
        );
      } else expect(bytes.subarray(0, 2).toString()).toBe("PK");
    }
    await page
      .getByRole("button", { name: "Share report", exact: true })
      .click();
    const email = await page
      .getByRole("link", { name: "Email summary" })
      .getAttribute("href");
    const whatsapp = await page
      .getByRole("link", { name: "WhatsApp summary" })
      .getAttribute("href");
    expect(email).toMatch(/^mailto:/);
    expect(whatsapp).toMatch(/^https:\/\/wa.me\/\?text=/);
    for (const link of [email, whatsapp]) {
      expect(decodeURIComponent(link!)).toContain("Score: 8/100");
      expect(link).not.toContain(sessionId);
      expect(link).not.toContain("localhost");
      expect(link).not.toContain("127.0.0.1");
    }
    await page.getByRole("button", { name: "Prepare attachment" }).click();
    await page.getByRole("button", { name: "Open share options" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Confirm delivery there" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { shared: string[] }).shared,
      ),
    ).toEqual(["persona-lab-report-r1.pdf"]);
    await page.getByLabel("Attachment format").selectOption("docx");
    await page.getByRole("button", { name: "Prepare attachment" }).click();
    await page.getByRole("button", { name: "Open share options" }).click();
    expect(
      await page.evaluate(
        () => (window as unknown as { shared: string[] }).shared,
      ),
    ).toEqual(["persona-lab-report-r1.docx"]);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          throw new DOMException("Cancelled", "AbortError");
        },
      });
    });
    await page.getByRole("button", { name: "Open share options" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Sharing cancelled" }),
    ).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "canShare", {
        configurable: true,
        value: () => false,
      });
    });
    await page.getByRole("button", { name: "Open share options" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "File sharing is unavailable" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 320, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      audit.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      (
        await page.request.post(endpoint, {
          headers,
          data: { format: "html", revision: 1 },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.post(endpoint, {
          headers: { origin: "https://foreign.example" },
          data: { format: "pdf", revision: 1 },
        })
      ).status(),
    ).toBe(403);
    const outsider = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3101",
      extraHTTPHeaders: headers,
    });
    try {
      expect(
        (
          await outsider.post(endpoint, {
            data: { format: "pdf", revision: 1 },
          })
        ).status(),
      ).toBe(404);
    } finally {
      await outsider.dispose();
    }
    await page.request.post(`/api/branches/${branchId}/turns`, {
      headers,
      data: {
        text: "What is your budget?",
        revision: 1,
        key: crypto.randomUUID(),
      },
    });
    const stale = await page.request.post(endpoint, {
      headers,
      data: { format: "pdf", revision: 1 },
    });
    expect(stale.status()).toBe(409);
    expect(stale.headers()["cache-control"]).toBe("no-store");
  } finally {
    expect(
      (
        await page.request.delete(`/api/sessions/${sessionId}`, { headers })
      ).ok(),
    ).toBe(true);
  }
});
