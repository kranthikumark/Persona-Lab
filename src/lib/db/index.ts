import "server-only";
import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { personaDb?: PrismaClient };
export const db = globalDb.personaDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.personaDb = db;
