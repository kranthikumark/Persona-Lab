import { describe, expect, it } from "vitest";
import { localizedContent, presentationFor } from "@/lib/localization/content";
import { canonicalForRules, latinDigits } from "@/lib/localization/rules";
import { acceptancePreview, localeAvailable } from "@/lib/localization/release";
import { resolveRuntime, progressFor } from "@/lib/simulation/progression";
import { initialState } from "@/lib/simulation/domain";
import { evaluateLocalized, validateEvidence } from "@/lib/evaluation/rubric";
const proposal = {
  utterance: "ok",
  trustDelta: 5,
  frustrationDelta: -3,
  interestDelta: 2,
};
const history = (texts: readonly string[]) => ({
  messages: texts.map((content, i) => ({
    id: `m${i}`,
    role: "user",
    turn: i + 1,
    sequence: i * 2 + 1,
    content,
  })),
  events: texts.map((_, i) => ({
    id: `e${i}`,
    turn: i + 1,
    payload: { messageId: `m${i}` },
  })),
});
it("keeps native practice closed in production and on non-local acceptance hosts", () => {
  expect(localeAvailable("hi-IN", { PERSONA_HINDI_TEXT: "true" })).toBe(false);
  expect(
    acceptancePreview({
      PERSONA_LOCALE_ACCEPTANCE: "1",
      NODE_ENV: "production",
    }),
  ).toBe(false);
  expect(
    acceptancePreview({
      PERSONA_LOCALE_ACCEPTANCE: "1",
      NODE_ENV: "development",
      APP_ORIGIN: "https://public.example",
    }),
  ).toBe(false);
  expect(
    localeAvailable("te-IN", {
      PERSONA_LOCALE_ACCEPTANCE: "1",
      NODE_ENV: "test",
      APP_ORIGIN: "http://127.0.0.1:3101",
    }),
  ).toBe(true);
  expect(latinDigits("१२५० ౧౨౫౦")).toBe("1250 1250");
});
for (const locale of ["hi-IN", "te-IN"] as const) {
  describe(locale, () => {
    it("preserves canonical fact identities, amounts, durations and original-script samples", () => {
      const content = localizedContent[locale];
      expect(content.facts.map((f) => f.id)).toEqual([
        "price",
        "limit",
        "waiting",
        "exclusions",
        "claims",
      ]);
      expect(content.facts[0].detail).toContain("₹1,250");
      expect(content.facts[1].detail).toContain("₹5,00,000");
      expect(content.facts[2].detail).toContain("30");
      expect(content.facts[3].detail).toContain("24");
      expect(
        content.samples.every((s) =>
          locale === "hi-IN"
            ? /\p{Script=Devanagari}/u.test(s)
            : /\p{Script=Telugu}/u.test(s),
        ),
      ).toBe(true);
    });
    it("uses native discovery and guarantee negation rather than English-only raw matching", () => {
      const runtime = resolveRuntime(`insurance-v1-rules-v3-${locale}`);
      const budget =
        locale === "hi-IN" ? "आपका बजट कितना है?" : "మీ బడ్జెట్ ఎంత?";
      const past =
        locale === "hi-IN"
          ? "आपका पिछला अनुभव क्या था?"
          : "మీ గత అనుభవం ఏమిటి?";
      const unsafe =
        locale === "hi-IN"
          ? "सभी दावों की स्वीकृति की गारंटी है।"
          : "ప్రతి క్లెయిమ్ ఆమోదానికి హామీ ఉంది.";
      const safe =
        locale === "hi-IN"
          ? "स्वीकृति की गारंटी नहीं है।"
          : "ఆమోదానికి హామీ లేదు.";
      expect(runtime.revealForInput(budget, [])).toContain("budgetConcern");
      expect(runtime.revealForInput(past, [])).toContain("previousExperience");
      expect(
        runtime.revealForInput(localizedContent[locale].facts[0].detail, []),
      ).toEqual([]);
      expect(runtime.transition(initialState, proposal, unsafe).violation).toBe(
        true,
      );
      expect(runtime.transition(initialState, proposal, safe).violation).toBe(
        false,
      );
      expect(canonicalForRules(safe, locale)).not.toContain(
        "All claims are guaranteed.",
      );
    });
    it("retains original evidence IDs/scripts with a versioned localized quality report", () => {
      const data = history(localizedContent[locale].samples);
      const before = structuredClone(data);
      const scope = { branchId: "branch", revision: 5, forkTurn: null };
      const report = evaluateLocalized(data, scope, locale);
      expect(data).toEqual(before);
      expect(report.totalChecks).toBe(9);
      expect(report.rubricVersion).toBe("insurance-rubric-v5");
      expect(report.categories[0].checks[0].status).toBe("demonstrated");
      expect(report.categories[1].checks[0].status).toBe("demonstrated");
      expect(validateEvidence(report, data, scope)).toEqual(report);
      report.categories[0].checks[0].evidence[0].messageId = "foreign";
      expect(() => validateEvidence(report, data, scope)).toThrow();
      const progress = progressFor(
        data.messages.map((m) => ({
          ...m,
          content: canonicalForRules(m.content, locale),
        })),
      );
      expect(progress.topics.find((t) => t.topic === "price")!.status).toBe(
        "answered",
      );
    });
  });
}

it("pins a cloned presentation without exposing verifier sample turns", () => {
  const presentation = presentationFor("hi-IN");
  expect("samples" in presentation).toBe(false);
  const original = localizedContent["hi-IN"].facts[0].detail;
  (presentation.facts[0] as { detail: string }).detail = "changed clone";
  expect(localizedContent["hi-IN"].facts[0].detail).toBe(original);
});
