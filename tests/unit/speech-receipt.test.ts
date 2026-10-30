import { afterEach, expect, it, vi } from "vitest";
import { issueSpeechReceipt, verifiedVoiceSource } from "@/lib/speech/receipt";
import { newConsent } from "@/lib/speech/contracts";
import { acceptedValidation, lengthRecord } from "@/lib/response-length";
afterEach(() => vi.unstubAllEnvs());
it("binds the raw transcript and consent to owner, branch and revision while preserving reviewed edits", () => {
  vi.stubEnv("META_API_KEY", "synthetic-receipt-signing-key");
  const consent = newConsent();
  const token = issueSpeechReceipt(
    "owner",
    "branch",
    2,
    "What is your budget",
    1000,
    consent,
  )!;
  const source = verifiedVoiceSource(
    token,
    "owner",
    "branch",
    2,
    "What is your monthly budget?",
  );
  expect(source.originalText).toBe("What is your monthly budget?");
  expect(source.modality).toBe("voice");
  expect(source.transcript).toMatchObject({
    rawText: "What is your budget",
    confirmedByUser: true,
    consent,
  });
  for (const [owner, branch, revision] of [
    ["foreign", "branch", 2],
    ["owner", "other", 2],
    ["owner", "branch", 3],
  ] as const)
    expect(() =>
      verifiedVoiceSource(token, owner, branch, revision, "Edited text"),
    ).toThrow();
});
it("rejects forged, missing, expired and secret-rotated receipts", () => {
  vi.stubEnv("META_API_KEY", "synthetic-key-one");
  const consent = newConsent();
  const token = issueSpeechReceipt(
    "owner",
    "branch",
    0,
    "Hello",
    1000,
    consent,
  )!;
  const [payload, signature] = token.split(".");
  for (const value of [
    undefined,
    `${payload}.${signature.slice(1)}a`,
    `${Buffer.from(JSON.stringify({ rawText: "forged" })).toString("base64url")}.${signature}`,
    "invalid",
  ])
    expect(() =>
      verifiedVoiceSource(value, "owner", "branch", 0, "Hello"),
    ).toThrow();
  const expired = issueSpeechReceipt("owner", "branch", 0, "Hello", 1000, {
    ...consent,
    grantedAt: new Date(0).toISOString(),
    expiresAt: new Date(1000).toISOString(),
  })!;
  expect(() =>
    verifiedVoiceSource(expired, "owner", "branch", 0, "Hello"),
  ).toThrow();
  vi.stubEnv("META_API_KEY", "different-secret");
  expect(() =>
    verifiedVoiceSource(token, "owner", "branch", 0, "Hello"),
  ).toThrow();
});
it("voice shares the exact word admission and length reporting contract", () => {
  const text = "What is your budget?";
  const typed = acceptedValidation(text),
    voice = acceptedValidation(text, "en-IN", "voice");
  expect({ ...voice, inputModality: "text" }).toEqual(typed);
  expect(
    lengthRecord({ content: text, metadata: { validation: voice } }).status,
  ).toBe("passed");
});
