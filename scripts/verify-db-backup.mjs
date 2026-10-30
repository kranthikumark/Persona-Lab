import { PrismaClient, Prisma } from "@prisma/client";
import { loadEnvFile } from "node:process";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

process.umask(0o077);
const root = path.resolve(".backups");
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--archive"))
  throw new Error(
    "Usage: node scripts/verify-db-backup.mjs [--archive path.dump]",
  );
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const archive = args.length
  ? path.resolve(args[1])
  : path.join(root, `${stamp}-${randomBytes(4).toString("hex")}.dump`);
const manifestPath = `${archive}.json`;
const errorLog = path.join(root, `${stamp}-verification-error.log`);
const digest = (rows) =>
  createHash("sha256")
    .update(JSON.stringify([...rows].sort()))
    .digest("hex");
const fileDigest = () =>
  createHash("sha256").update(fs.readFileSync(archive)).digest("hex");
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const tablesSQL = `SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' ORDER BY schemaname, tablename`;
const schemaSQL = `SELECT to_jsonb(t)::text AS row_text FROM (
 SELECT 'column' AS kind, table_schema AS schema, table_name AS object, column_name AS name,
 jsonb_build_object('type',data_type,'udt',udt_name,'nullable',is_nullable,'default',column_default,'position',ordinal_position)::text AS definition
 FROM information_schema.columns WHERE table_schema NOT LIKE 'pg_%' AND table_schema <> 'information_schema'
 UNION ALL SELECT 'constraint', n.nspname, cl.relname, c.conname, pg_get_constraintdef(c.oid)
 FROM pg_constraint c JOIN pg_class cl ON c.conrelid=cl.oid JOIN pg_namespace n ON cl.relnamespace=n.oid
 WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'
 UNION ALL SELECT 'index', schemaname, tablename, indexname, indexdef FROM pg_indexes
 WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema'
) t`;
function command(bin, argv, extraEnv = {}) {
  return execFileSync(bin, argv, {
    env: { ...process.env, PGHOST: "/tmp", ...extraEnv },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}
async function fingerprint(query) {
  const tables = await query(tablesSQL);
  const result = {};
  for (const { schemaname, tablename } of tables) {
    const rows = await query(
      `SELECT to_jsonb(t)::text AS row_text FROM ${quote(schemaname)}.${quote(tablename)} t`,
    );
    result[`${schemaname}.${tablename}`] = {
      rows: rows.length,
      sha256: digest(rows.map((r) => r.row_text)),
    };
  }
  return {
    tables: result,
    schemaSha256: digest((await query(schemaSQL)).map((r) => r.row_text)),
  };
}
let scratch,
  port,
  created = false,
  manifest;
try {
  if (!args.length) {
    if (fs.existsSync(".env")) loadEnvFile(".env");
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
      throw new Error(
        "Only local database backups are supported by this helper.",
      );
    port = url.port || "5432";
    const database = decodeURIComponent(url.pathname.slice(1));
    if (!database || ["postgres", "template0", "template1"].includes(database))
      throw new Error("Use the dedicated application database.");
    const db = new PrismaClient();
    try {
      manifest = await db.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
          const [{ snapshot }] = await tx.$queryRawUnsafe(
            "SELECT pg_export_snapshot() AS snapshot",
          );
          const before = await fingerprint((sql) => tx.$queryRawUnsafe(sql));
          command(
            "pg_dump",
            [
              "--format=custom",
              "--compress=6",
              "--no-owner",
              "--no-acl",
              "--snapshot",
              snapshot,
              "--host",
              url.hostname.replaceAll(/[\[\]]/g, ""),
              "--port",
              port,
              "--username",
              decodeURIComponent(url.username),
              "--dbname",
              database,
              "--file",
              archive,
            ],
            { PGPASSWORD: decodeURIComponent(url.password) },
          );
          fs.chmodSync(archive, 0o600);
          return {
            version: 1,
            createdAt: new Date().toISOString(),
            source: "local-application-database",
            port,
            pgDump: command("pg_dump", ["--version"]).trim(),
            ...before,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          timeout: 120000,
        },
      );
    } finally {
      await db.$disconnect();
    }
    manifest.archiveSha256 = fileDigest();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
  } else {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    port = manifest.port;
    if (
      manifest.version !== 1 ||
      !/^\d{1,5}$/.test(port) ||
      manifest.archiveSha256 !== fileDigest()
    )
      throw new Error("Backup manifest or archive checksum is invalid.");
  }
  // Administrative tools use the local OS role and socket, never the app password.
  scratch = `persona_lab_restore_v501_${randomBytes(8).toString("hex")}`;
  command(
    "createdb",
    ["--port", port, "--maintenance-db", "postgres", scratch],
    { PGPASSWORD: "" },
  );
  created = true;
  command(
    "pg_restore",
    [
      "--port",
      port,
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      scratch,
      archive,
    ],
    { PGPASSWORD: "" },
  );
  const restored = await fingerprint(async (sql) => {
    const output = command(
      "psql",
      [
        "-X",
        "--port",
        port,
        "--dbname",
        scratch,
        "--tuples-only",
        "--no-align",
        "--set",
        "ON_ERROR_STOP=1",
        "--command",
        `SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json) FROM (${sql}) q`,
      ],
      { PGPASSWORD: "" },
    );
    return JSON.parse(output.trim());
  });
  if (
    JSON.stringify(restored) !==
    JSON.stringify({
      tables: manifest.tables,
      schemaSha256: manifest.schemaSha256,
    })
  )
    throw new Error(
      "Restored database fingerprints differ from the backup snapshot.",
    );
  command("dropdb", ["--port", port, scratch], { PGPASSWORD: "" });
  created = false;
  manifest.verifiedAt = new Date().toISOString();
  manifest.restore = {
    status: "passed",
    schemaMatched: true,
    allRowsMatched: true,
    temporaryDatabaseRemoved: true,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", {
    mode: 0o600,
  });
  console.log(
    JSON.stringify({
      status: "passed",
      archive,
      manifest: manifestPath,
      tables: Object.keys(manifest.tables).length,
      rows: Object.values(manifest.tables).reduce((sum, t) => sum + t.rows, 0),
      schemaMatched: true,
      allRowsMatched: true,
      temporaryDatabaseRemoved: true,
    }),
  );
} catch (error) {
  fs.writeFileSync(
    errorLog,
    String(error?.stack ?? error) + "\n" + String(error?.stderr ?? ""),
    { mode: 0o600 },
  );
  console.error(`Backup verification failed. Private diagnostic: ${errorLog}`);
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      command("dropdb", ["--port", port, scratch], { PGPASSWORD: "" });
    } catch {
      console.error(
        "Temporary restore cleanup failed; see the private diagnostic directory.",
      );
      process.exitCode = 1;
    }
  }
}
