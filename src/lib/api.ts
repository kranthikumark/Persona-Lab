import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ProviderError } from "@/lib/ai/providers";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function owner(create = false) {
  const jar = await cookies();
  let token = jar.get("persona_owner")?.value;
  if ((!token || !/^[a-f0-9]{64}$/.test(token)) && create) {
    token = randomBytes(32).toString("hex");
    jar.set("persona_owner", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return token && /^[a-f0-9]{64}$/.test(token) ? hash(token) : null;
}
export function assertOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN ?? "http://127.0.0.1:3100";
  const received = request.headers.get("origin");
  if (received === expected) return;
  // Local browser URLs may use either loopback spelling. Keep this exception
  // development-only, on the configured protocol and port, with no wildcard hosts.
  if (received && process.env.NODE_ENV === "development") {
    try {
      const configured = new URL(expected);
      const incoming = new URL(received);
      const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
      if (
        received === incoming.origin &&
        loopback.has(configured.hostname) &&
        loopback.has(incoming.hostname) &&
        incoming.protocol === configured.protocol &&
        incoming.port === configured.port
      )
        return;
    } catch {
      // Missing, malformed, and foreign origins fail closed below.
    }
  }
  throw new ApiError(403, "This request must come from the application.");
}
export async function jsonBody(request: Request, maxBytes = 12000) {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes)
    throw new ApiError(413, "Request is too large.");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new ApiError(413, "Request is too large.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "Send valid JSON.");
  }
}
export async function handle(action: () => Promise<unknown>) {
  try {
    return NextResponse.json(await action(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof ProviderError)
      return NextResponse.json(
        { error: error.message },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Check your input and try again." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    // Do not log Prisma connection strings, provider bodies, or personal conversation text.
    console.error(
      "PERSONA LAB request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      {
        error:
          "The studio couldn't complete this request. Check the database setup and try again.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
