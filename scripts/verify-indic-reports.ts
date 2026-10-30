import { writeFile, mkdir } from "node:fs/promises";
import { localizedContent } from "../src/lib/localization/content";
import { evaluateLocalized } from "../src/lib/evaluation/rubric";
import { reportDocument } from "../src/lib/reports/data";
import { reportPDF } from "../src/lib/reports/pdf";
import { reportDOCX } from "../src/lib/reports/docx";
import { acceptedValidation } from "../src/lib/response-length";
const dir = "output/reports/v5-06";
await mkdir(dir, { recursive: true });
for (const locale of ["hi-IN", "te-IN"] as const) {
  const extra =
    locale === "hi-IN"
      ? "मैं आपकी चिंता समझता हूँ। आपका पिछला अनुभव क्या था?"
      : "మీ ఆందోళన అర్థమవుతోంది. మీ గత అనుభవం ఏమిటి?";
  const texts = [
    extra +
      " Mixed-script specimen: हिन्दी क्ष · తెలుగు క్\u200dష · ₹1,250 · ₹5,00,000.",
    ...localizedContent[locale].samples,
  ];
  const h = {
    messages: texts.map((content, i) => ({
      id: `m${i}`,
      role: "user",
      turn: i + 1,
      sequence: i * 2 + 1,
      content,
      metadata: { validation: acceptedValidation(content, locale) },
    })),
    events: texts.map((_, i) => ({
      id: `e${i}`,
      turn: i + 1,
      payload: { messageId: `m${i}` },
    })),
  };
  const r = evaluateLocalized(
    h,
    { branchId: "fixture", revision: texts.length, forkTurn: null },
    locale,
  );
  const d = reportDocument(
    r,
    locale === "hi-IN" ? "अभ्यास समीक्षा" : "అభ్యాస సమీక్ష",
    "2026-10-29T05:00:00.000Z",
    h.messages,
  );
  await writeFile(`${dir}/report-${locale}.pdf`, await reportPDF(d));
  await writeFile(`${dir}/report-${locale}.docx`, await reportDOCX(d));
  console.log(
    JSON.stringify({
      locale,
      score: r.overall,
      coverage: r.assessedChecks,
      pdf: true,
      docx: true,
    }),
  );
}
