import { db } from "../src/lib/db";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import {
  ensureEnglishLocalization,
  localizationContent,
} from "../src/lib/practice/server";
import { DEFAULT_CATALOG } from "../src/lib/practice/metadata";
import { insuranceScenario } from "../src/lib/scenarios/insurance";
if (existsSync(".env")) loadEnvFile(".env");
try {
  const scenario = await db.scenario.upsert({
    where: {
      slug_version: {
        slug: insuranceScenario.slug,
        version: insuranceScenario.version,
      },
    },
    update: {},
    create: {
      slug: insuranceScenario.slug,
      version: insuranceScenario.version,
      definition: insuranceScenario,
      catalogMetadata: DEFAULT_CATALOG,
    },
  });
  await ensureEnglishLocalization(
    scenario.id,
    localizationContent(insuranceScenario),
  );
  console.log(
    "Seeded fictional insurance scenario v1 and immutable English baseline.",
  );
} finally {
  await db.$disconnect();
}
