import { loadEnvFile } from "node:process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { insuranceScenario } from "../src/lib/scenarios/insurance";

try {
  loadEnvFile(".env");
} catch {
  /* Managed hosts inject the environment. */
}
async function filesAt(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? filesAt(join(directory, entry.name))
        : [join(directory, entry.name)],
    ),
  );
  return nested.flat();
}
async function check() {
  const origin = new URL(process.env.APP_ORIGIN!);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    (!local && origin.protocol !== "https:") ||
    !["https:", "http:"].includes(origin.protocol) ||
    origin.origin !== process.env.APP_ORIGIN
  )
    throw new Error("Invalid origin");
  const database = new URL(process.env.DATABASE_URL!);
  if (!["postgres:", "postgresql:"].includes(database.protocol))
    throw new Error("Invalid database");
  if (!["mock", "meta"].includes(process.env.AI_PROVIDER ?? ""))
    throw new Error("Invalid provider");
  if (process.env.AI_PROVIDER === "meta" && !process.env.META_API_KEY?.trim())
    throw new Error("Missing credential");
  const forbidden = [
    process.env.META_API_KEY,
    process.env.DATABASE_URL,
    "META_API_KEY",
    "privateKnowledge",
    ...Object.values(insuranceScenario.character.privateKnowledge),
  ].filter((value): value is string => !!value && value.length > 8);
  const files = (await filesAt(".next/static")).filter((file) =>
    /\.(js|map|json)$/.test(file),
  );
  if (!files.length) throw new Error("Missing build");
  for (const file of files) {
    const bytes = await readFile(file);
    if (
      forbidden.some(
        (value) =>
          bytes.includes(Buffer.from(value)) ||
          bytes.includes(Buffer.from(JSON.stringify(value).slice(1, -1))),
      )
    )
      throw new Error("Private content in build");
  }
  console.log(
    JSON.stringify({
      configuration: "passed",
      clientPrivacy: "passed",
      scannedFiles: files.length,
      deployment: local ? "localhost" : "https-configured",
      provider: process.env.AI_PROVIDER,
    }),
  );
}
try {
  await check();
} catch {
  // Parsing errors can contain actual credential strings. Never print the cause.
  console.error(
    "Release check failed. Verify APP_ORIGIN, DATABASE_URL, AI_PROVIDER, private credential presence, and the production client build. No secrets were printed.",
  );
  process.exitCode = 1;
}
