import { loadEnvFile } from "node:process";
import { execFileSync } from "node:child_process";
import { userInfo } from "node:os";
import { randomBytes } from "node:crypto";
loadEnvFile(".env");
const source = new URL(process.env.DATABASE_URL);
if (!["localhost", "127.0.0.1"].includes(source.hostname))
  throw new Error("Local PostgreSQL required.");
const name = `persona_v507_test_${randomBytes(5).toString("hex")}`;
const target = new URL(source);
target.pathname = `/${name}`;
const args = ["--port", source.port || "5432"];
const adminEnv = {
  ...process.env,
  PGHOST: "/tmp",
  PGUSER: userInfo().username,
  PGPASSWORD: "",
};
const env = {
  ...process.env,
  PGPASSWORD: decodeURIComponent(source.password),
  DATABASE_URL: target.toString(),
  PERSONA_CATALOG_TEST_DB: "1",
};
try {
  execFileSync(
    "createdb",
    [...args, "--owner", decodeURIComponent(source.username), name],
    { env: adminEnv, stdio: "pipe" },
  );
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync(
    "npx",
    ["vitest", "run", "tests/integration/scenario-studio.test.ts"],
    { env, stdio: "inherit" },
  );
} finally {
  execFileSync("dropdb", [...args, "--if-exists", name], {
    env: adminEnv,
    stdio: "pipe",
  });
  console.log("Disposable catalog acceptance database removed.");
}
