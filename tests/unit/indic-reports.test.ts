import { expect, it } from "vitest";
import { needsIndic, scriptRuns } from "@/lib/reports/script-fonts";
import { reportDocument } from "@/lib/reports/data";
import { evaluateLocalized } from "@/lib/evaluation/rubric";
import { localizedContent } from "@/lib/localization/content";
it("retains Unicode and conjunct joiners in script-specific font runs", () => {
  const text = "₹1,250 తెలుగు క్\u200dష हिन्दी क्ष";
  const runs = scriptRuns(text);
  expect(runs.map((r) => r.text).join("")).toBe(text);
  expect(runs.find((r) => r.text.includes("క్\u200dష"))?.font).toBe(
    "Noto Sans Telugu",
  );
  expect(runs.find((r) => r.text.includes("हिन्दी"))?.font).toBe(
    "Noto Sans Devanagari",
  );
  expect(needsIndic({ locale: "en-IN", evidence: text })).toBe(true);
  expect(needsIndic({ evidence: "English ₹1,250" })).toBe(false);
});
for (const locale of ["hi-IN", "te-IN"] as const)
  it(`${locale} exports localized feedback with original-script evidence and no foreign transcript`, () => {
    const content = localizedContent[locale].samples[2];
    const h = {
      messages: [{ id: "m", role: "user", turn: 1, sequence: 1, content }],
      events: [{ id: "e", turn: 1, payload: { messageId: "m" } }],
    };
    const report = evaluateLocalized(
      h,
      { branchId: "private-branch", revision: 1, forkTurn: null },
      locale,
    );
    const data = reportDocument(
      report,
      "Original",
      "2026-10-29T00:00:00.000Z",
      [...h.messages, { id: "other", content: "PRIVATE OTHER MESSAGE" }],
    );
    expect(data.locale).toBe(locale);
    expect(data.categories[0].checks[1].evidence[0].excerpt).toContain(
      locale === "hi-IN" ? "कॉस्मेटिक" : "కాస్మెటిక్",
    );
    expect(data.categories[0].label).not.toBe("Factual accuracy / compliance");
    expect(JSON.stringify(data)).not.toContain("private-branch");
    expect(JSON.stringify(data)).not.toContain("PRIVATE OTHER MESSAGE");
  });
