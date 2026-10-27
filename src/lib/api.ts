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
  if (!token && create) {
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
  if (request.headers.get("origin") !== expected)
    throw new ApiError(403, "This request must come from the application.");
}
export async function jsonBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 12000)
    throw new ApiError(413, "Request is too large.");
  const text = await request.text();
  if (text.length > 12000) throw new ApiError(413, "Request is too large.");
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
        { status: error.status },
      );
    if (error instanceof ProviderError)
      return NextResponse.json({ error: error.message }, { status: 502 });
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "Check your input and try again." },
        { status: 400 },
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
      { status: 503 },
    );
  }
}
