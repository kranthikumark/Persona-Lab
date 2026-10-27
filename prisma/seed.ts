import { PrismaClient } from "@prisma/client";
import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { insuranceScenario } from "../src/lib/scenarios/insurance";
if (existsSync(".env")) loadEnvFile(".env");
const db = new PrismaClient();
try {
  await db.scenario.upsert({
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
    },
  });
  console.log("Seeded fictional insurance scenario v1.");
} finally {
  await db.$disconnect();
}
