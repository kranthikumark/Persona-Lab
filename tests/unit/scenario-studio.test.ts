import { expect, it } from "vitest";
import {
  initialDraft,
  DraftContentSchema,
  SaveDraftSchema,
} from "@/lib/catalog/schema";
it("starts from a complete canonical insurance contract", () => {
  const draft = initialDraft();
  expect(draft.approvedFacts).toHaveLength(5);
  expect(draft.rubric.accuracy).toBe(30);
  expect(DraftContentSchema.parse(draft)).toEqual(draft);
});
it("rejects altered facts, constraints, characters, rubric, media and invented translations", () => {
  const d = initialDraft();
  const candidates = [
    { ...d, approvedFacts: [] },
    {
      ...d,
      approvedFacts: d.approvedFacts.map((f) => ({
        ...f,
        detail: "Guaranteed",
      })),
    },
    { ...d, constraints: [] },
    { ...d, character: "interviewer" },
    { ...d, rubric: { ...d.rubric, accuracy: 100 } },
    { ...d, catalog: { ...d.catalog, supportedModalities: ["voice"] } },
    { ...d, catalog: { ...d.catalog, audience: "PERSONAL" } },
    { ...d, localizations: [{ locale: "te-IN", status: "reviewed" }] },
  ];
  for (const input of candidates)
    expect(DraftContentSchema.safeParse(input).success).toBe(false);
});
it("rejects browser role/review claims and incomplete definitions", () => {
  const d = initialDraft();
  for (const input of [
    { revision: 1, content: d, role: "operator" },
    { revision: 1, content: d, status: "reviewed" },
    { revision: 0, content: d },
    { revision: 1, content: { ...d, objectives: [] } },
    {
      revision: 1,
      content: { ...d, catalog: { ...d.catalog, skillGoals: [] } },
    },
  ])
    expect(SaveDraftSchema.safeParse(input).success).toBe(false);
});
