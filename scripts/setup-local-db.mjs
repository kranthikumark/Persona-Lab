import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env")) throw new Error(".env already exists; preserve it and configure the database manually.");
const password = randomBytes(24).toString("hex");
const sql = `CREATE ROLE persona_lab LOGIN PASSWORD '${password}';\nCREATE DATABASE persona_lab OWNER persona_lab;\n`;
const result = spawnSync("psql", ["-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" });
if (result.status !== 0) throw new Error("Local database creation failed. Check PostgreSQL access and whether persona_lab already exists. No existing database was modified.");
writeFileSync(".env", `DATABASE_URL="postgresql://persona_lab:${password}@127.0.0.1:5432/persona_lab?schema=public"\nAI_PROVIDER="mock"\nMETA_API_KEY=""\nMETA_MODEL="muse-spark-1.3"\nAPP_ORIGIN="http://127.0.0.1:3100"\n`, { mode: 0o600, flag: "wx" });
console.log("Created dedicated persona_lab role/database and private .env. Credentials were not printed.");
