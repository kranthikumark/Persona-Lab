import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCapabilities,
  StartPracticeSchema,
} from "@/lib/capabilities/registry";
import { requireTextPractice } from "@/lib/capabilities/server";
import { GET } from "@/app/api/capabilities/route";
import { POST } from "@/app/api/sessions/route";
import { startSession } from "@/lib/simulation/service";

afterEach(() => vi.unstubAllEnvs());
describe("V5 capability release gates", () => {
  it("ships English text only", () => {
    const registry = buildCapabilities();
    expect(registry.englishText.available).toBe(true);
    expect(
      Object.values(registry).filter((item) => item.available),
    ).toHaveLength(1);
  });
  it.each(["false", "TRUE", "1", "", "invalid"])(
    "fails closed for flag %j",
    (value) => {
      expect(
        buildCapabilities({ PERSONA_ENGLISH_TEXT: value }).englishText
          .available,
      ).toBe(false);
    },
  );
  it("does not enable unverified capabilities through environment flags", () => {
    const registry = buildCapabilities(
      Object.fromEntries(
        [
          "HINDI_TEXT",
          "TELUGU_TEXT",
          "PERSONAL_EDITION",
          "VOICE",
          "VIDEO_INPUT",
          "CAMERA_COACHING",
          "AVATAR_3D",
        ].map((key) => [`PERSONA_${key}`, "true"]),
      ),
    );
    expect(
      Object.values(registry).filter((item) => item.available),
    ).toHaveLength(1);
  });
  it("keeps the legacy empty request and rejects unsupported modes/locales", () => {
    expect(StartPracticeSchema.parse({})).toEqual({});
    expect(StartPracticeSchema.safeParse({ mode: "voice" }).success).toBe(
      false,
    );
    expect(
      StartPracticeSchema.safeParse({ practiceLocale: "hi-IN" }).success,
    ).toBe(true);
    expect(StartPracticeSchema.safeParse({ video: true }).success).toBe(false);
  });
  it("blocks session creation before database/provider admission when disabled", async () => {
    vi.stubEnv("PERSONA_ENGLISH_TEXT", "false");
    expect(() => requireTextPractice()).toThrow("temporarily unavailable");
    await expect(startSession("fictional-owner")).rejects.toThrow(
      "temporarily unavailable",
    );
  });
  it("rejects unsupported session requests at the route boundary", async () => {
    const response = await POST(
      new Request("http://127.0.0.1:3100/api/sessions", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3100",
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "voice" }),
      }),
    );
    expect(response.status).toBe(400);
  });
  it("returns only public status and prevents caching", async () => {
    vi.stubEnv("META_API_KEY", "private-test-marker");
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("private-test-marker");
  });
});
