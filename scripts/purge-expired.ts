import { loadEnvFile } from "node:process";
import { db } from "../src/lib/db/index";
import { purgeExpiredSessions } from "../src/lib/release/retention";

try {
  loadEnvFile(".env");
} catch {
  /* Managed hosts inject environment variables. */
}
try {
  const result = await purgeExpiredSessions();
  // Counts only: never log ownership tokens, IDs, transcripts, or database URLs.
  console.log(JSON.stringify(result));
} catch {
  console.error("Expiry cleanup failed. Check the database and retry.");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
