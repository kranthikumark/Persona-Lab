import "server-only";
import { publicScenario } from "./public";

export const insuranceScenario = {
  ...publicScenario,
  character: {
    ...publicScenario.character,
    privateKnowledge: {
      budgetConcern:
        "Prefers to stay below ₹1,500/month; do not disclose until the trainee asks about budget.",
      previousExperience:
        "A friend had a claim rejected; disclose only when the trainee asks why she is concerned.",
    },
  },
} as const;
export type ScenarioDefinition = Omit<
  typeof insuranceScenario,
  "contextVersion" | "rubricVersion"
> & {
  contextVersion: string;
  rubricVersion: string;
  evaluationVersion?: string;
  localizedPresentation?: import("@/lib/localization/content").LocalePresentation;
};
