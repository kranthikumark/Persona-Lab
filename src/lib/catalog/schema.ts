import { z } from "zod";
import { publicScenario } from "@/lib/scenarios/public";
import { CatalogSchema, DEFAULT_CATALOG } from "@/lib/practice/metadata";

// Authoring is deliberately bounded to the executable, tested insurance contract.
// New roles/facts/rubrics require a new runtime, not arbitrary prompt injection.
export const DraftContentSchema = z
  .object({
    template: z.literal("insurance-text-v1"),
    title: z.string().trim().min(3).max(100),
    description: z.string().trim().min(10).max(600),
    catalog: CatalogSchema.extend({
      audience: z.literal("BUSINESS"),
      supportedModalities: z.tuple([z.literal("text")]),
      traineeRole: z.literal(DEFAULT_CATALOG.traineeRole),
      skillGoals: z
        .array(z.enum(DEFAULT_CATALOG.skillGoals as [string, ...string[]]))
        .min(1)
        .max(4),
    }),
    objectives: z.array(z.string().trim().min(5).max(240)).min(1).max(5),
    character: z.literal("priya-insurance-v1"),
    constraints: z.array(z.string()),
    approvedFacts: z.array(
      z
        .object({ id: z.string(), title: z.string(), detail: z.string() })
        .strict(),
    ),
    rubric: z
      .object({
        accuracy: z.literal(30),
        discovery: z.literal(20),
        objections: z.literal(20),
        communication: z.literal(15),
        nextStep: z.literal(15),
      })
      .strict(),
    localizations: z.tuple([
      z
        .object({
          locale: z.literal("en-IN"),
          status: z.literal("baseline"),
          source: z.literal("canonical-template"),
        })
        .strict(),
    ]),
  })
  .strict()
  .superRefine((value, ctx) => {
    for (const key of ["constraints", "approvedFacts", "rubric"] as const)
      if (JSON.stringify(value[key]) !== JSON.stringify(publicScenario[key]))
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "This section must match the verified insurance contract.",
        });
  });
export type DraftContent = z.infer<typeof DraftContentSchema>;
export function initialDraft(): DraftContent {
  return DraftContentSchema.parse({
    template: "insurance-text-v1",
    title: "My trust conversation",
    description: publicScenario.description,
    catalog: DEFAULT_CATALOG,
    objectives: [...publicScenario.objectives],
    character: "priya-insurance-v1",
    constraints: [...publicScenario.constraints],
    approvedFacts: publicScenario.approvedFacts.map((f) => ({ ...f })),
    rubric: { ...publicScenario.rubric },
    localizations: [
      { locale: "en-IN", status: "baseline", source: "canonical-template" },
    ],
  });
}
export const SaveDraftSchema = z
  .object({
    revision: z.number().int().positive(),
    content: DraftContentSchema,
  })
  .strict();
export type CatalogEntry = {
  id: string;
  title: string;
  description: string;
  version: number;
  catalog: z.infer<typeof CatalogSchema>;
  locales: string[];
};
