import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { localizedContent } from "../../src/lib/localization/content";
const headers = { origin: "http://127.0.0.1:3101" };
for (const locale of ["hi-IN", "te-IN"] as const)
  test(`${locale}: native PDF, embedded Word and private summary sharing`, async ({
    page,
    playwright,
  }) => {
    const created = await page.request.post("/api/sessions", {
      headers,
      data: { practiceLocale: locale },
    });
    expect(created.ok()).toBe(true);
    const { sessionId, branchId } = await created.json();
    const foreign = await playwright.request.newContext({
      baseURL: "http://127.0.0.1:3101",
    });
    try {
      await page.setViewportSize({ width: 390, height: 900 });
      const text = localizedContent[locale].samples[2];
      expect(
        (
          await page.request.post(`/api/branches/${branchId}/turns`, {
            headers,
            data: { text, revision: 0, key: crypto.randomUUID() },
          })
        ).ok(),
      ).toBe(true);
      await page.goto(`/sessions/${sessionId}`);
      await page.getByRole("button", { name: /Field notes/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("insurance-rubric-v5");
      for (const [name, format] of [
        ["Download PDF", "pdf"],
        ["Download Word", "docx"],
      ] as const) {
        const pending = page.waitForEvent("download");
        await dialog.getByRole("button", { name, exact: true }).click();
        const download = await pending;
        const bytes = await readFile((await download.path())!);
        if (format === "pdf") {
          expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
          expect(
            (await PDFDocument.load(bytes)).getPageCount(),
          ).toBeGreaterThan(1);
        } else expect(bytes.subarray(0, 2).toString()).toBe("PK");
      }
      await dialog
        .getByRole("button", { name: "Share report", exact: true })
        .click();
      for (const name of ["Email summary", "WhatsApp summary"]) {
        const href = await dialog
          .getByRole("link", { name, exact: true })
          .getAttribute("href");
        const decoded = decodeURIComponent(href!);
        expect(decoded).toContain(
          locale === "hi-IN"
            ? "अभ्यास का रिपोर्ट कार्ड"
            : "అభ్యాస నివేదిక కార్డు",
        );
        expect(decoded).not.toContain(sessionId);
        expect(decoded).not.toContain("127.0.0.1");
      }
      const input = { format: "pdf", revision: 1 };
      expect(
        (
          await foreign.post(`/api/branches/${branchId}/evaluation/export`, {
            headers,
            data: input,
          })
        ).status(),
      ).toBe(404);
      expect(
        (
          await page.request.post(
            `/api/branches/${branchId}/evaluation/export`,
            { headers: { origin: "https://foreign.invalid" }, data: input },
          )
        ).status(),
      ).toBe(403);
      expect(
        (
          await page.request.post(
            `/api/branches/${branchId}/evaluation/export`,
            { headers, data: { ...input, revision: 0 } },
          )
        ).status(),
      ).toBe(409);
    } finally {
      await foreign.dispose();
      expect(
        (
          await page.request.delete(`/api/sessions/${sessionId}`, { headers })
        ).ok(),
      ).toBe(true);
    }
  });
