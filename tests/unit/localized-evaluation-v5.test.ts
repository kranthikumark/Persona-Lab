import { expect, it } from "vitest";
import { evaluateLocalized, validateEvidence } from "@/lib/evaluation/rubric";
import { evaluateLocalized as frozen } from "@/lib/evaluation/v4-rubric";
const scope = { branchId: "branch", revision: 3, forkTurn: null };
const history = (texts: string[]) => ({
  messages: texts.map((content, i) => ({
    id: `m${i}`,
    role: "user",
    sequence: i * 2 + 1,
    turn: i + 1,
    content,
  })),
  events: texts.map((_, i) => ({
    id: `e${i}`,
    turn: i + 1,
    payload: { messageId: `m${i}` },
  })),
});
const checks = (report: ReturnType<typeof evaluateLocalized>) =>
  Object.fromEntries(
    report.categories.flatMap((c) => c.checks).map((c) => [c.id, c]),
  );
it("recognizes Telugu acknowledgements, coordinated exclusions and decision review without reversing negation", () => {
  const h = history([
    "మీ ఆందోళన అర్థమవుతోంది. కాస్మెటిక్ సర్జరీలు, వైద్యపరంగా అవసరం లేని చికిత్సలు కవర్ కావు.",
    "కాస్మెటిక్, వైద్యుడు సూచించని చికిత్సలు మినహాయింపులు.",
    "అధికారిక పాలసీ పత్రం, మినహాయింపులు పరిశీలించిన తర్వాతే నిర్ణయం తీసుకోవడం మంచిది.",
  ]);
  const old = frozen(h, scope, "te-IN"),
    report = evaluateLocalized(h, scope, "te-IN"),
    c = checks(report);
  expect(checks(old).acknowledgement.status).toBe("insufficient");
  expect(checks(old)["approved-terms"].status).toBe("concern");
  for (const id of [
    "acknowledgement",
    "approved-terms",
    "limits-explained",
    "review-offer",
    "unpressured-choice",
  ])
    expect(c[id].status).toBe("demonstrated");
  expect(c["budget-question"].status).toBe("insufficient");
  expect(validateEvidence(report, h, scope)).toEqual(report);
  expect(validateEvidence(old, h, scope)).toEqual(old);
});
it("does not credit a cosmetic mention alone or a conditional exclusion as checked coverage", () => {
  for (const text of [
    "కాస్మెటిక్ చికిత్సలు.",
    "కాస్మెటిక్ చికిత్సలు మినహాయింపులుగా పేర్కొంటే కవరేజ్ ఉండదు.",
  ])
    expect(
      checks(evaluateLocalized(history([text]), scope, "te-IN"))[
        "approved-terms"
      ].status,
    ).toBe("insufficient");
  expect(
    checks(
      evaluateLocalized(
        history(["కాస్మెటిక్ చికిత్సలకు కవరేజ్ ఉంటుంది."]),
        scope,
        "te-IN",
      ),
    )["approved-terms"].status,
  ).toBe("concern");
});
it("retains earlier genuine contradictions, identifies later corrections and rejects altered correction references", () => {
  const h = history([
    "కాస్మెటిక్ చికిత్సలకు కవరేజ్ ఉంటుంది.",
    "కాస్మెటిక్ చికిత్సలు కవర్ కావు.",
  ]);
  const report = evaluateLocalized(h, scope, "te-IN");
  expect(checks(report)["approved-terms"].status).toBe("concern");
  if (!("corrections" in report)) throw new Error("Expected v5");
  expect(
    report.corrections.find((c) => c.checkId === "approved-terms"),
  ).toEqual({
    checkId: "approved-terms",
    earlierTurns: [1],
    correctedTurns: [2],
  });
  report.corrections[0].correctedTurns = [99];
  expect(() => validateEvidence(report, h, scope)).toThrow();
});
it("recognizes equivalent Hindi exclusion and acknowledgement with mixed English approval boundaries", () => {
  const report = evaluateLocalized(
    history([
      "मैं आपकी चिंता समझता हूँ। कॉस्मेटिक प्रक्रियाएँ, डॉक्टर द्वारा निर्धारित न किए गए उपचार कवर नहीं हैं। Approval is never guaranteed.",
    ]),
    scope,
    "hi-IN",
  );
  expect(checks(report).acknowledgement.status).toBe("demonstrated");
  expect(checks(report)["approved-terms"].status).toBe("demonstrated");
  expect(checks(report)["claim-boundaries"].status).toBe("demonstrated");
});

it("distinguishes an exercise contradiction from a generic comparison and records the later correction", () => {
  const h = history([
    "ఈ ఉదాహరణ ప్లాన్‌కు నిర్దిష్ట ప్రీమియం వివరాలు లేవు.",
    "కాస్మెటిక్ చికిత్సలు కవర్ కావు. ముందుగా ఉన్న వ్యాధులకు 24 నెలల వేచి ఉండే కాలం ఉంటుంది.",
  ]);
  const report = evaluateLocalized(h, scope, "te-IN");
  expect(checks(report)["approved-terms"].status).toBe("concern");
  expect(checks(report)["approved-terms"].feedback).toContain("fixed facts");
  if (!("corrections" in report)) throw new Error("v5 expected");
  expect(report.corrections[0].correctedTurns).toContain(2);
});

it("retains all genuine concern references when fixed-fact and coverage contradictions coexist", () => {
  const h = history([
    "కాస్మెటిక్ చికిత్సలకు కవరేజ్ ఉంటుంది.",
    "ఈ ఉదాహరణ ప్లాన్‌కు నిర్దిష్ట ప్రీమియం వివరాలు లేవు.",
  ]);
  const report = evaluateLocalized(h, scope, "te-IN");
  expect(checks(report)["approved-terms"].evidence.map((e) => e.turn)).toEqual([
    1, 2,
  ]);
});
